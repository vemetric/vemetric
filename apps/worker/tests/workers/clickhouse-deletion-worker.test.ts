import { removeDeviceJobDeduplication } from '@vemetric/queues/create-device-queue';
import { createUserQueue } from '@vemetric/queues/create-user-queue';
import { clickhouseDeletion } from 'clickhouse';
import { dbClickhouseDeletion, dbUserIdentificationMap } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteBufferedUserSessions } from '../../src/ingestion/session-buffer';
import { flushSessionBuffer } from '../../src/ingestion/session-flush';
import { invalidateIngestionUser } from '../../src/utils/user-cache';
import {
  deletePendingData,
  deleteQueuedUsers,
  PENDING_MIN_AGE_MS,
  purgeDeletedRows,
} from '../../src/workers/clickhouse-deletion-worker';

const redis = vi.hoisted(() => ({ getdel: vi.fn(), del: vi.fn() }));

vi.mock('clickhouse', () => ({
  clickhouseDeletion: {
    deleteProjects: vi.fn(),
    deleteProjectUsers: vi.fn(),
    findProjectUserDevices: vi.fn().mockResolvedValue([]),
    applyDeletedMasks: vi.fn(),
  },
}));
vi.mock('database', () => ({
  dbUserIdentificationMap: { deleteByUserIds: vi.fn() },
  dbClickhouseDeletion: {
    findById: vi.fn(),
    findPending: vi.fn(),
    findUnrepeated: vi.fn().mockResolvedValue([]),
    markRepeated: vi.fn(),
    markDeleted: vi.fn(),
    markFailed: vi.fn(),
    countUnpurged: vi.fn(),
    markPurged: vi.fn(),
  },
}));
vi.mock('@vemetric/queues/clickhouse-deletion-queue', () => ({ DELETE_USERS_JOB: 'delete-users' }));
vi.mock('@vemetric/queues/create-device-queue', () => ({ removeDeviceJobDeduplication: vi.fn() }));
vi.mock('@vemetric/queues/create-user-queue', () => ({ createUserQueue: { remove: vi.fn(), getJob: vi.fn() } }));
vi.mock('../../src/utils/user-cache', () => ({ invalidateIngestionUser: vi.fn() }));
vi.mock('../../src/ingestion/redis', () => ({ stateRedis: () => redis }));
vi.mock('../../src/ingestion/session-buffer', () => ({ deleteBufferedUserSessions: vi.fn().mockResolvedValue([]) }));
vi.mock('../../src/ingestion/session-flush', () => ({ flushSessionBuffer: vi.fn() }));
vi.mock('../../src/utils/device', () => ({
  deviceWrittenKey: (projectId: string, userId: string, deviceId: string) =>
    `vm:device-written:${projectId}:${userId}:${deviceId}`,
}));
vi.mock('../../src/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

const deletion = (id: string, projectId: string, userIds: string[] = [], deletedAt: Date | null = null) => ({
  id,
  projectId,
  userIds,
  reason: 'project-deleted',
  createdAt: new Date(),
  deletedAt,
  repeatedAt: null,
  purgedAt: null,
  error: null,
});

describe('deletePendingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createUserQueue.remove).mockResolvedValue(1);
  });

  it('does nothing without pending deletions', async () => {
    vi.mocked(dbClickhouseDeletion.findPending).mockResolvedValue([]);

    expect(await deletePendingData()).toEqual({ deleted: 0, repeated: 0, failed: 0 });
    expect(dbClickhouseDeletion.findPending).toHaveBeenCalledWith(PENDING_MIN_AGE_MS);
    expect(clickhouseDeletion.deleteProjects).not.toHaveBeenCalled();
    expect(clickhouseDeletion.deleteProjectUsers).not.toHaveBeenCalled();
  });

  it('deletes whole projects in one batch and users per deletion', async () => {
    vi.mocked(dbClickhouseDeletion.findPending).mockResolvedValue([
      deletion('a', '1'),
      deletion('b', '2'),
      deletion('c', '1'),
      deletion('d', '3', ['10', '11']),
    ]);

    expect(await deletePendingData()).toEqual({ deleted: 4, repeated: 0, failed: 0 });
    expect(clickhouseDeletion.deleteProjects).toHaveBeenCalledWith(['1', '2']);
    expect(clickhouseDeletion.deleteProjectUsers).toHaveBeenCalledWith('3', ['10', '11']);
    expect(dbUserIdentificationMap.deleteByUserIds).toHaveBeenCalledWith('3', ['10', '11']);
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['d'], expect.any(Date));
    expect(dbClickhouseDeletion.markFailed).not.toHaveBeenCalled();
  });

  it('keeps failed deletions pending and fails the job after trying the rest', async () => {
    vi.mocked(dbClickhouseDeletion.findPending).mockResolvedValue([deletion('a', '1'), deletion('d', '3', ['10'])]);
    vi.mocked(clickhouseDeletion.deleteProjects).mockRejectedValueOnce(new Error('mutation failed'));

    await expect(deletePendingData()).rejects.toThrow('1 ClickHouse deletion(s) failed: a');
    expect(dbClickhouseDeletion.markFailed).toHaveBeenCalledWith(['a'], 'Error: mutation failed');
    expect(dbClickhouseDeletion.markDeleted).not.toHaveBeenCalledWith(['a']);
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['d'], expect.any(Date));
  });
});

describe('deletePendingData, repeating user deletions', () => {
  const deletedAt = new Date('2026-11-20T13:54:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbClickhouseDeletion.findPending).mockResolvedValue([]);
    vi.mocked(createUserQueue.remove).mockResolvedValue(1);
    vi.mocked(createUserQueue.getJob).mockResolvedValue(undefined);
  });

  it('deletes again only what was tracked before the deletion, once', async () => {
    vi.mocked(dbClickhouseDeletion.findUnrepeated).mockResolvedValueOnce([deletion('d', '3', ['10'], deletedAt)]);

    expect(await deletePendingData()).toEqual({ deleted: 0, repeated: 1, failed: 0 });
    expect(dbClickhouseDeletion.findUnrepeated).toHaveBeenCalledWith(PENDING_MIN_AGE_MS);
    expect(clickhouseDeletion.deleteProjectUsers).toHaveBeenCalledWith('3', ['10'], undefined, deletedAt);
    expect(dbClickhouseDeletion.markRepeated).toHaveBeenCalledWith(['d']);
    expect(dbUserIdentificationMap.deleteByUserIds).not.toHaveBeenCalled();
  });

  it('removes a create-user job from before the deletion, but not one of a user who came back', async () => {
    vi.mocked(dbClickhouseDeletion.findUnrepeated).mockResolvedValueOnce([deletion('d', '3', ['10', '11'], deletedAt)]);
    vi.mocked(createUserQueue.getJob).mockImplementation(
      async (id) =>
        ({ id, timestamp: id === '3-10' ? deletedAt.getTime() - 1000 : deletedAt.getTime() + 1000 }) as never,
    );

    await deletePendingData();
    expect(createUserQueue.remove).toHaveBeenCalledWith('3-10');
    expect(createUserQueue.remove).not.toHaveBeenCalledWith('3-11');
    expect(invalidateIngestionUser).toHaveBeenCalledWith(BigInt(3), BigInt(10));
    expect(invalidateIngestionUser).not.toHaveBeenCalledWith(BigInt(3), BigInt(11));
  });

  it('leaves failed repeats for the next night', async () => {
    vi.mocked(dbClickhouseDeletion.findUnrepeated).mockResolvedValueOnce([deletion('d', '3', ['10'], deletedAt)]);
    vi.mocked(clickhouseDeletion.deleteProjectUsers).mockRejectedValueOnce(new Error('timeout'));

    await expect(deletePendingData()).rejects.toThrow('1 ClickHouse deletion(s) failed: d');
    expect(dbClickhouseDeletion.markFailed).toHaveBeenCalledWith(['d'], 'Error: timeout');
    expect(dbClickhouseDeletion.markRepeated).not.toHaveBeenCalled();
  });
});

describe('deleteQueuedUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createUserQueue.remove).mockResolvedValue(1);
  });

  it('deletes the users and everything that still points to their ids', async () => {
    vi.mocked(dbClickhouseDeletion.findById).mockResolvedValue(deletion('d', '3', ['10', '11']));

    expect(await deleteQueuedUsers('d')).toEqual({ deleted: 1 });
    expect(clickhouseDeletion.deleteProjectUsers).toHaveBeenCalledWith('3', ['10', '11']);
    expect(dbUserIdentificationMap.deleteByUserIds).toHaveBeenCalledWith('3', ['10', '11']);
    expect(createUserQueue.remove).toHaveBeenCalledWith('3-10');
    expect(createUserQueue.remove).toHaveBeenCalledWith('3-11');
    expect(invalidateIngestionUser).toHaveBeenCalledWith(BigInt(3), BigInt(10));
    expect(invalidateIngestionUser).toHaveBeenCalledWith(BigInt(3), BigInt(11));
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['d'], expect.any(Date));
  });

  it('clears session state before the ClickHouse delete and the rest only after it succeeded', async () => {
    const order: string[] = [];
    vi.mocked(dbClickhouseDeletion.findById).mockResolvedValue(deletion('d', '3', ['10']));
    vi.mocked(deleteBufferedUserSessions).mockImplementationOnce(async () => {
      order.push('sessions');
      return [];
    });
    vi.mocked(clickhouseDeletion.deleteProjectUsers).mockImplementation(async () => void order.push('clickhouse'));
    vi.mocked(dbUserIdentificationMap.deleteByUserIds).mockImplementation((() => {
      order.push('identification');
      return Promise.resolve({ count: 1 });
    }) as never);

    await deleteQueuedUsers('d');
    expect(order).toEqual(['sessions', 'clickhouse', 'identification']);
  });

  it("ends the hub's current session and writes tombstones for the buffered sessions", async () => {
    vi.mocked(dbClickhouseDeletion.findById).mockResolvedValue(deletion('d', '3', ['10', '11']));
    redis.getdel.mockImplementation(async (key: string) => (key === 'sessionid:3:10' ? 'current' : null));
    vi.mocked(deleteBufferedUserSessions).mockImplementation(async (_projectId, userId) =>
      userId === BigInt(10) ? ['vm:{session-state}:3:current', 'vm:{session-state}:3:pending'] : [],
    );

    await deleteQueuedUsers('d');
    expect(redis.getdel).toHaveBeenCalledWith('sessionid:3:10');
    expect(redis.getdel).toHaveBeenCalledWith('sessionid:3:11');
    expect(deleteBufferedUserSessions).toHaveBeenCalledWith(BigInt(3), BigInt(10), ['current']);
    expect(deleteBufferedUserSessions).toHaveBeenCalledWith(BigInt(3), BigInt(11), []);
    expect(flushSessionBuffer).toHaveBeenCalledTimes(1);
    expect(flushSessionBuffer).toHaveBeenCalledWith(2, ['vm:{session-state}:3:current', 'vm:{session-state}:3:pending']);
  });

  it('clears the device cache and the create-device job deduplication', async () => {
    vi.mocked(dbClickhouseDeletion.findById).mockResolvedValue(deletion('d', '3', ['10']));
    vi.mocked(clickhouseDeletion.findProjectUserDevices).mockResolvedValueOnce([
      { userId: '10', id: '100' },
      { userId: '10', id: '101' },
    ]);

    await deleteQueuedUsers('d');
    expect(clickhouseDeletion.findProjectUserDevices).toHaveBeenCalledWith('3', ['10']);
    expect(redis.del).toHaveBeenCalledWith('vm:device-written:3:10:100', 'vm:device-written:3:10:101');
    expect(removeDeviceJobDeduplication).toHaveBeenCalledWith('3', '10');
  });

  it('marks the deletion with the time it started, the cutoff for the repeat', async () => {
    vi.mocked(dbClickhouseDeletion.findById).mockResolvedValue(deletion('d', '3', ['10']));
    let deleteStarted = 0;
    vi.mocked(clickhouseDeletion.deleteProjectUsers).mockImplementationOnce(async () => {
      deleteStarted = Date.now();
    });

    await deleteQueuedUsers('d');
    const [, deletedAt] = vi.mocked(dbClickhouseDeletion.markDeleted).mock.calls[0];
    expect(deletedAt!.getTime()).toBeLessThanOrEqual(deleteStarted);
  });

  it('skips deletions the nightly run already did', async () => {
    vi.mocked(dbClickhouseDeletion.findById).mockResolvedValue(deletion('d', '3', ['10'], new Date()));

    expect(await deleteQueuedUsers('d')).toEqual({ deleted: 0 });
    expect(clickhouseDeletion.deleteProjectUsers).not.toHaveBeenCalled();
  });

  it('fails while a create-user job for the user is running, so it is tried again', async () => {
    vi.mocked(dbClickhouseDeletion.findById).mockResolvedValue(deletion('d', '3', ['10']));
    vi.mocked(createUserQueue.remove).mockResolvedValue(0);
    vi.mocked(createUserQueue.getJob).mockResolvedValue({ id: '3-10' } as never);

    await expect(deleteQueuedUsers('d')).rejects.toThrow('create-user job 3-10 is running');
    expect(dbClickhouseDeletion.markFailed).toHaveBeenCalledWith(['d'], 'Error: create-user job 3-10 is running');
    expect(dbClickhouseDeletion.markDeleted).not.toHaveBeenCalled();
  });

  it('does not fail when there is no create-user job anymore', async () => {
    vi.mocked(dbClickhouseDeletion.findById).mockResolvedValue(deletion('d', '3', ['10']));
    vi.mocked(createUserQueue.remove).mockResolvedValue(0);
    vi.mocked(createUserQueue.getJob).mockResolvedValue(undefined);

    expect(await deleteQueuedUsers('d')).toEqual({ deleted: 1 });
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['d'], expect.any(Date));
  });
});

describe('purgeDeletedRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips the rewrite when nothing was deleted since the last purge', async () => {
    vi.mocked(dbClickhouseDeletion.countUnpurged).mockResolvedValue(0);

    expect(await purgeDeletedRows()).toEqual({ purged: 0 });
    expect(clickhouseDeletion.applyDeletedMasks).not.toHaveBeenCalled();
  });

  it('applies the deleted masks and marks what was deleted before it started', async () => {
    vi.mocked(dbClickhouseDeletion.countUnpurged).mockResolvedValue(2);
    vi.mocked(dbClickhouseDeletion.markPurged).mockResolvedValue({ count: 2 });
    const before = Date.now();

    expect(await purgeDeletedRows()).toEqual({ purged: 2 });
    expect(clickhouseDeletion.applyDeletedMasks).toHaveBeenCalled();
    const startedAt = vi.mocked(dbClickhouseDeletion.markPurged).mock.calls[0][0];
    expect(startedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('marks nothing as purged when applying the masks fails', async () => {
    vi.mocked(dbClickhouseDeletion.countUnpurged).mockResolvedValue(1);
    vi.mocked(clickhouseDeletion.applyDeletedMasks).mockRejectedValueOnce(new Error('timeout'));

    await expect(purgeDeletedRows()).rejects.toThrow('timeout');
    expect(dbClickhouseDeletion.markPurged).not.toHaveBeenCalled();
  });
});
