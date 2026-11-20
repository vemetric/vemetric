import { createUserQueue } from '@vemetric/queues/create-user-queue';
import { clickhouseDeletion } from 'clickhouse';
import { dbClickhouseDeletion, dbUserIdentificationMap } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateIngestionUser } from '../../src/utils/user-cache';
import {
  deletePendingData,
  deleteQueuedUsers,
  PENDING_MIN_AGE_MS,
  purgeDeletedRows,
} from '../../src/workers/clickhouse-deletion-worker';

vi.mock('clickhouse', () => ({
  clickhouseDeletion: { deleteProjects: vi.fn(), deleteProjectUsers: vi.fn(), applyDeletedMasks: vi.fn() },
}));
vi.mock('database', () => ({
  dbUserIdentificationMap: { deleteByUserIds: vi.fn() },
  dbClickhouseDeletion: {
    findById: vi.fn(),
    findPending: vi.fn(),
    markDeleted: vi.fn(),
    markFailed: vi.fn(),
    countUnpurged: vi.fn(),
    markPurged: vi.fn(),
  },
}));
vi.mock('@vemetric/queues/clickhouse-deletion-queue', () => ({ DELETE_USERS_JOB: 'delete-users' }));
vi.mock('@vemetric/queues/create-user-queue', () => ({ createUserQueue: { remove: vi.fn(), getJob: vi.fn() } }));
vi.mock('../../src/utils/user-cache', () => ({ invalidateIngestionUser: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

const deletion = (id: string, projectId: string, userIds: string[] = [], deletedAt: Date | null = null) => ({
  id,
  projectId,
  userIds,
  reason: 'project-deleted',
  createdAt: new Date(),
  deletedAt,
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

    expect(await deletePendingData()).toEqual({ deleted: 0, failed: 0 });
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

    expect(await deletePendingData()).toEqual({ deleted: 4, failed: 0 });
    expect(clickhouseDeletion.deleteProjects).toHaveBeenCalledWith(['1', '2']);
    expect(clickhouseDeletion.deleteProjectUsers).toHaveBeenCalledWith('3', ['10', '11']);
    expect(dbUserIdentificationMap.deleteByUserIds).toHaveBeenCalledWith('3', ['10', '11']);
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['d']);
    expect(dbClickhouseDeletion.markFailed).not.toHaveBeenCalled();
  });

  it('keeps failed deletions pending and fails the job after trying the rest', async () => {
    vi.mocked(dbClickhouseDeletion.findPending).mockResolvedValue([deletion('a', '1'), deletion('d', '3', ['10'])]);
    vi.mocked(clickhouseDeletion.deleteProjects).mockRejectedValueOnce(new Error('mutation failed'));

    await expect(deletePendingData()).rejects.toThrow('1 ClickHouse deletion(s) failed: a');
    expect(dbClickhouseDeletion.markFailed).toHaveBeenCalledWith(['a'], 'Error: mutation failed');
    expect(dbClickhouseDeletion.markDeleted).not.toHaveBeenCalledWith(['a']);
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['d']);
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
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['d']);
  });

  it('cleans up only after the ClickHouse delete succeeded', async () => {
    const order: string[] = [];
    vi.mocked(dbClickhouseDeletion.findById).mockResolvedValue(deletion('d', '3', ['10']));
    vi.mocked(clickhouseDeletion.deleteProjectUsers).mockImplementation(async () => void order.push('clickhouse'));
    vi.mocked(dbUserIdentificationMap.deleteByUserIds).mockImplementation((() => {
      order.push('identification');
      return Promise.resolve({ count: 1 });
    }) as never);

    await deleteQueuedUsers('d');
    expect(order).toEqual(['clickhouse', 'identification']);
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
    expect(dbClickhouseDeletion.markDeleted).toHaveBeenCalledWith(['d']);
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
