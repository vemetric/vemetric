import type { MergeUserQueueProps } from '@vemetric/queues/merge-user-queue';
import * as BullMQ from 'bullmq';
import { clickhouseDevice, clickhouseEvent, type ClickhouseSession } from 'clickhouse';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findPendingSession,
  getBufferedSessions,
  reassignBufferedSession,
  deleteBufferedSession,
  persistSessionUpdates,
} from '../../src/ingestion';
import { reassignExistingSessionsToEvents } from '../../src/utils/merge-user';
import { initMergeUserWorker } from '../../src/workers/merge-user-worker';

const captured = vi.hoisted(() => ({
  run: undefined as
    | undefined
    | ((
        job: Pick<BullMQ.Job<MergeUserQueueProps>, 'data' | 'updateData' | 'moveToDelayed'>,
        token?: string,
      ) => Promise<void>),
}));
vi.mock('bullmq', async (importOriginal) => ({
  ...(await importOriginal<typeof BullMQ>()),
  Worker: class {
    constructor(_name: string, processor: NonNullable<typeof captured.run>) {
      captured.run = processor;
    }
  },
}));
vi.mock('@vemetric/queues/merge-user-queue', () => ({ mergeUserQueue: { setGlobalConcurrency: vi.fn() } }));
vi.mock('database', () => ({
  dbUserIdentificationMap: { findByUserId: vi.fn().mockResolvedValue({ identifier: 'identified' }) },
}));
vi.mock('clickhouse', () => ({
  clickhouseDevice: { findByUserId: vi.fn().mockResolvedValue([]), delete: vi.fn() },
  clickhouseSession: { findByUserId: vi.fn().mockResolvedValue([]) },
  clickhouseUser: { findById: vi.fn().mockResolvedValue(null) },
  clickhouseEvent: {
    findByUserId: vi
      .fn()
      .mockResolvedValue([{ id: 'event', sessionId: 'session', createdAt: '2026-09-04 12:00:00.000' }]),
    insert: vi.fn(),
    delete: vi.fn(),
  },
  clickhouseDateToISO: (value: string) => value,
  getDeviceId: () => BigInt(3),
}));
vi.mock('../../src/ingestion', () => ({
  assertIngestionStateStorage: vi.fn().mockResolvedValue(undefined),
  getBufferedSessions: vi.fn().mockResolvedValue([]),
  findPendingSession: vi.fn(),
  reassignBufferedSession: vi.fn(),
  deleteBufferedSession: vi.fn(),
  persistSessionUpdates: vi.fn(),
}));
vi.mock('../../src/utils/device', () => ({ insertDeviceIfNotExists: vi.fn() }));
vi.mock('../../src/utils/merge-user', () => ({
  reassignExistingSessionsToEvents: vi.fn().mockResolvedValue({
    sessionsWithTimeUpdates: [],
    sessionIdMapping: new Map(),
    unmatchedSessionIds: new Set(['session']),
  }),
}));

describe('merge write ordering', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getBufferedSessions).mockResolvedValue([]);
    await initMergeUserWorker();
  });
  function createJob(sessionWaitStartedAt?: number) {
    const job = {
      data: { projectId: '1', oldUserId: '2', newUserId: '3', sessionWaitStartedAt } as MergeUserQueueProps,
      updateData: vi.fn(async (data: MergeUserQueueProps) => {
        job.data = data;
      }),
      moveToDelayed: vi.fn().mockResolvedValue(undefined),
    };
    return job;
  }

  it('postpones the same job before any merge writes, then proceeds once ready', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    vi.mocked(getBufferedSessions).mockResolvedValue([{ id: 'session' } as ClickhouseSession]);
    vi.mocked(findPendingSession).mockResolvedValueOnce('session');
    const waiting = createJob();
    await expect(captured.run!(waiting, 'lock-token')).rejects.toBeInstanceOf(BullMQ.DelayedError);
    expect(waiting.updateData).toHaveBeenCalledWith({ ...waiting.data, sessionWaitStartedAt: 100_000 });
    expect(waiting.moveToDelayed).toHaveBeenCalledWith(105_000, 'lock-token');
    expect(clickhouseDevice.findByUserId).not.toHaveBeenCalled();
    expect(reassignBufferedSession).not.toHaveBeenCalled();
    expect(deleteBufferedSession).not.toHaveBeenCalled();
    expect(persistSessionUpdates).not.toHaveBeenCalled();
    expect(clickhouseEvent.insert).not.toHaveBeenCalled();
    expect(clickhouseEvent.delete).not.toHaveBeenCalled();

    await captured.run!(waiting, 'new-lock-token');
    expect(reassignBufferedSession).toHaveBeenCalledOnce();
    expect(clickhouseEvent.insert).toHaveBeenCalledOnce();
  });

  it('preserves the original wait deadline across processing attempts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(200_000);
    vi.mocked(findPendingSession).mockResolvedValueOnce('session');
    const waiting = createJob(100_000);
    await expect(captured.run!(waiting, 'token')).rejects.toBeInstanceOf(BullMQ.DelayedError);
    expect(waiting.updateData).not.toHaveBeenCalled();
    expect(waiting.moveToDelayed).toHaveBeenCalledWith(205_000, 'token');
  });

  it('continues with events after a pending session exceeds the wait deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000 + 5 * 60 * 1000);
    vi.mocked(findPendingSession).mockResolvedValueOnce('session');
    const waiting = createJob(100_000);
    await captured.run!(waiting, 'token');
    expect(waiting.moveToDelayed).not.toHaveBeenCalled();
    expect(reassignBufferedSession).not.toHaveBeenCalled();
    expect(clickhouseEvent.insert).toHaveBeenCalledOnce();
  });

  it('migrates an event whose historical session does not exist', async () => {
    const job = createJob();
    await captured.run!(job, 'token');
    expect(findPendingSession).toHaveBeenCalledWith(BigInt(1), ['session']);
    expect(job.moveToDelayed).not.toHaveBeenCalled();
    expect(reassignBufferedSession).not.toHaveBeenCalled();
    expect(clickhouseEvent.insert).toHaveBeenCalledOnce();
    expect(clickhouseEvent.insert).toHaveBeenCalledWith([
      expect.objectContaining({ sessionId: 'session', userId: BigInt(3) }),
    ]);
  });

  it('propagates Redis postponement failures as real failures', async () => {
    vi.mocked(findPendingSession).mockResolvedValueOnce('session');
    const waiting = createJob();
    waiting.moveToDelayed.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(captured.run!(waiting, 'token')).rejects.toThrow('Redis unavailable');
    expect(clickhouseEvent.insert).not.toHaveBeenCalled();
  });

  it('keeps the old sessions when none of their events are stored yet', async () => {
    // With the event queue behind, the merge finds no events of the old user.
    vi.mocked(clickhouseEvent.findByUserId).mockResolvedValueOnce([]);
    vi.mocked(reassignExistingSessionsToEvents).mockResolvedValueOnce({
      sessionsWithTimeUpdates: [],
      sessionIdMapping: new Map(),
      unmatchedSessionIds: new Set(),
    });
    vi.mocked(getBufferedSessions).mockResolvedValue([{ id: 'visit' } as ClickhouseSession]);
    await captured.run!(createJob(), 'token');
    expect(deleteBufferedSession).not.toHaveBeenCalled();
    expect(reassignBufferedSession).toHaveBeenCalledWith(BigInt(1), 'visit', BigInt(3), 'identified', undefined);
  });

  it('deletes only sessions whose known events all moved into sessions of the new user', async () => {
    vi.mocked(reassignExistingSessionsToEvents).mockResolvedValueOnce({
      sessionsWithTimeUpdates: [],
      sessionIdMapping: new Map([
        ['merged', 'target'],
        ['partly-merged', 'target'],
      ]),
      unmatchedSessionIds: new Set(['partly-merged', 'unmatched']),
    });
    vi.mocked(getBufferedSessions).mockResolvedValue(
      ['merged', 'partly-merged', 'unmatched', 'without-events'].map((id) => ({ id }) as ClickhouseSession),
    );
    await captured.run!(createJob(), 'token');
    expect(vi.mocked(deleteBufferedSession).mock.calls).toEqual([[BigInt(1), 'merged']]);
    expect(vi.mocked(reassignBufferedSession).mock.calls.map((call) => call[1])).toEqual([
      'partly-merged',
      'unmatched',
      'without-events',
    ]);
  });

  it('passes the session the hub handed over to the matching', async () => {
    const job = createJob();
    job.data.continuedSessionId = 'visit';
    await captured.run!(job, 'token');
    expect(reassignExistingSessionsToEvents).toHaveBeenCalledWith(
      expect.objectContaining({ continuedSessionId: 'visit' }),
    );
  });
});
