import { mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { QueueEvents } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { findPendingSession } from '../src/ingestion';
import { initMergeUserWorker } from '../src/workers/merge-user-worker';

vi.mock('@vemetric/queues/merge-user-queue', async (importOriginal) => {
  if (process.env.INGESTION_STATE_TESTS !== '1') return { mergeUserQueue: {} };
  if (new URL(process.env.REDIS_URL!).port !== '16389') throw new Error('Use disposable Redis on port 16389');
  return importOriginal();
});
vi.mock('@vemetric/queues/queue-utils', () => ({ defaultQueueConnection: { url: process.env.REDIS_URL } }));
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
vi.mock('../src/ingestion', () => ({
  assertIngestionStateStorage: vi.fn().mockResolvedValue(undefined),
  getBufferedSessions: vi.fn().mockResolvedValue([]),
  findPendingSession: vi.fn(),
  moveBufferedSession: vi.fn(),
  persistSessionUpdates: vi.fn(),
}));
vi.mock('../src/utils/device', () => ({ insertDeviceIfNotExists: vi.fn() }));
vi.mock('../src/utils/merge-user', () => ({
  reassignExistingSessionsToEvents: vi
    .fn()
    .mockResolvedValue({ sessionsWithTimeUpdates: [], sessionIdMapping: new Map() }),
}));

describe.skipIf(process.env.INGESTION_STATE_TESTS !== '1')('merge postponement against Redis', () => {
  it('preserves the same job through a worker restart without consuming failure retries or blocking other merges', async () => {
    if (new URL(process.env.REDIS_URL!).port !== '16389') throw new Error('Use disposable Redis on port 16389');
    const events = new QueueEvents(mergeUserQueue.name, { connection: { url: process.env.REDIS_URL } });
    const workers: Awaited<ReturnType<typeof initMergeUserWorker>>[] = [];
    let initialized = false;
    vi.mocked(findPendingSession).mockImplementation(async (projectId) =>
      projectId === BigInt(1) && !initialized ? 'session' : undefined,
    );
    try {
      await mergeUserQueue.obliterate({ force: true });
      await events.waitUntilReady();
      workers.push(await initMergeUserWorker());
      const waiting = await mergeUserQueue.add(
        'waiting',
        { projectId: '1', oldUserId: '2', newUserId: '3' },
        { attempts: 1 },
      );
      await vi.waitFor(async () => expect(await waiting.getState()).toBe('delayed'), { timeout: 5_000 });
      const postponed = await mergeUserQueue.getJob(waiting.id!);
      expect(postponed!.attemptsMade).toBe(0);
      expect(postponed!.data.sessionWaitStartedAt).toEqual(expect.any(Number));

      const other = await mergeUserQueue.add('ready', { projectId: '2', oldUserId: '2', newUserId: '3' });
      await other.waitUntilFinished(events, 3_000);
      expect(await waiting.getState()).toBe('delayed');

      await workers[0]!.close();
      initialized = true;
      workers.push(await initMergeUserWorker());
      await waiting.waitUntilFinished(events, 10_000);
      const completed = await mergeUserQueue.getJob(waiting.id!);
      expect(completed!.id).toBe(waiting.id);
      expect(completed!.data.sessionWaitStartedAt).toBe(postponed!.data.sessionWaitStartedAt);
      expect(completed!.attemptsStarted).toBeGreaterThanOrEqual(2);
      expect(await mergeUserQueue.getCompletedCount()).toBe(2);
      expect(await mergeUserQueue.getFailedCount()).toBe(0);
    } finally {
      await Promise.all(workers.map((worker) => worker.close()));
      await mergeUserQueue.obliterate({ force: true });
      await events.close();
      await mergeUserQueue.close();
    }
  }, 20_000);
});
