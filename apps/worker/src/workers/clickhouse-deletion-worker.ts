import { sessionIdRedisKey } from '@vemetric/common/session';
import {
  clickhouseDeletionQueue,
  DELETE_USERS_DEDUPLICATION_ID,
  DELETE_USERS_JOB,
  queueUserDeletionJob,
} from '@vemetric/queues/clickhouse-deletion-queue';
import { removeDeviceJobDeduplication } from '@vemetric/queues/create-device-queue';
import { createUserQueue } from '@vemetric/queues/create-user-queue';
import { clickhouseDeletionQueueName } from '@vemetric/queues/queue-names';
import { defaultQueueConnection } from '@vemetric/queues/queue-utils';
import { type Job, Queue, Worker } from 'bullmq';
import { clickhouseDeletion } from 'clickhouse';
import { type ClickhouseDeletion, dbClickhouseDeletion, dbUserIdentificationMap } from 'database';
import { stateRedis } from '../ingestion/redis';
import { deleteBufferedUserSessions } from '../ingestion/session-buffer';
import { flushSessionBuffer } from '../ingestion/session-flush';
import { deviceWrittenKey } from '../utils/device';
import { workerName } from '../utils/env';
import { logger } from '../utils/logger';
import { queueTelemetry } from '../utils/telemetry';
import { invalidateIngestionUser } from '../utils/user-cache';

// Deletes queued ClickHouse data (ClickhouseDeletion rows: deleted projects, users of deleted accounts) when traffic is
// low. Postgres is deleted right away, so the data is no longer reachable in the meantime.
//
// - `delete`, every night: lightweight deletes for everything queued at least an hour ago. The hour lets queued jobs
//   and cached sessions of a deleted project finish writing first. User deletions are repeated once, for data written
//   late.
// - `purge`, every Sunday after the nightly run: removes the deleted rows physically (`APPLY DELETED MASK`), batched
//   for the whole week, so personal data is gone well within a month.
// - `delete-users`, a few minutes after users were deleted in the app (see queueUserDeletionJob).
//
// Failed deletions keep `deletedAt` (or `repeatedAt`) empty and are tried again the next night.

export const PENDING_MIN_AGE_MS = 60 * 60 * 1000;
// Lets events the hub accepted just before a deletion be written first.
export const QUEUED_USERS_MIN_AGE_MS = 60 * 1000;
export const QUEUED_USERS_BATCH_SIZE = 1000;

export async function deletePendingData() {
  const pending = await dbClickhouseDeletion.findPending(PENDING_MIN_AGE_MS);
  const unrepeated = await dbClickhouseDeletion.findUnrepeated(PENDING_MIN_AGE_MS);
  if (pending.length === 0 && unrepeated.length === 0) return { deleted: 0, repeated: 0, failed: 0 };

  const failed: string[] = [];
  const projects = pending.filter((deletion) => deletion.userIds.length === 0);
  if (projects.length > 0) {
    const ids = projects.map((deletion) => deletion.id);
    try {
      await clickhouseDeletion.deleteProjects(Array.from(new Set(projects.map((deletion) => deletion.projectId))));
      await dbClickhouseDeletion.markDeleted(ids);
    } catch (err) {
      logger.error({ err, deletions: ids }, 'Failed to delete ClickHouse data of projects');
      await dbClickhouseDeletion.markFailed(ids, String(err));
      failed.push(...ids);
    }
  }
  failed.push(...(await deleteUsers(pending.filter((deletion) => deletion.userIds.length > 0))));
  const deleted = pending.length - failed.length;

  const failedRepeats = await repeatUserDeletions(unrepeated);
  failed.push(...failedRepeats);

  const result = { deleted, repeated: unrepeated.length - failedRepeats.length, failed: failed.length };
  logger.info(result, 'Deleted queued ClickHouse data');
  if (failed.length > 0) {
    // Fails the job so it shows up in the dashboard; the deletions are tried again the next night.
    throw new Error(`${failed.length} ClickHouse deletion(s) failed: ${failed.join(', ')}`);
  }
  return result;
}

export async function deleteQueuedUsers() {
  const deletions = await dbClickhouseDeletion.findPendingUsers(QUEUED_USERS_MIN_AGE_MS, QUEUED_USERS_BATCH_SIZE);
  const failed = await deleteUsers(deletions);
  if (failed.length > 0) {
    throw new Error(`${failed.length} user deletion(s) failed: ${failed.join(', ')}`);
  }
  const remaining = await dbClickhouseDeletion.countPendingUsers();
  if (remaining > 0) {
    await queueUserDeletionJob();
  }
  logger.info({ deleted: deletions.length, remaining }, 'Deleted ClickHouse data of users');
  return { deleted: deletions.length, remaining };
}

/** Returns the ids of the failed deletions. */
async function deleteUsers(deletions: ClickhouseDeletion[]) {
  if (deletions.length === 0) return [];
  const startedAt = new Date();
  const userIdsByProject = new Map<string, string[]>();
  for (const { projectId, userIds } of deletions) {
    userIdsByProject.set(projectId, [...(userIdsByProject.get(projectId) ?? []), ...userIds]);
  }

  const devices: Array<{ projectId: string; userId: string; id: string }> = [];
  try {
    for (const { projectId, userIds } of deletions) {
      for (const userId of userIds) {
        await deleteUserSessionState(BigInt(projectId), BigInt(userId));
      }
    }
    for (const [projectId, userIds] of Array.from(userIdsByProject)) {
      const found = await clickhouseDeletion.findProjectUserDevices(projectId, userIds);
      devices.push(...found.map((device) => ({ projectId, ...device })));
    }
    await clickhouseDeletion.deleteUsers(
      Array.from(userIdsByProject, ([projectId, userIds]) => ({ projectId, userIds })),
    );
  } catch (err) {
    const ids = deletions.map((deletion) => deletion.id);
    logger.error({ err, deletions: ids }, 'Failed to delete ClickHouse data of users');
    await dbClickhouseDeletion.markFailed(ids, String(err));
    return ids;
  }

  const done: string[] = [];
  const failed: string[] = [];
  for (const deletion of deletions) {
    try {
      await cleanUpDeletedUsers(deletion);
      done.push(deletion.id);
    } catch (err) {
      logger.error({ err, deletion: deletion.id }, 'Failed to clean up after deleting users');
      await dbClickhouseDeletion.markFailed([deletion.id], String(err));
      failed.push(deletion.id);
    }
  }
  if (devices.length > 0) {
    await stateRedis().del(...devices.map((device) => deviceWrittenKey(device.projectId, device.userId, device.id)));
  }
  if (done.length > 0) {
    await dbClickhouseDeletion.markDeleted(done, startedAt);
  }
  return failed;
}

// A deleted user can come back with the same user id (`_vuid` cookie). Anything still pointing to it would keep them
// from being created again, e.g. BullMQ drops a create-user job whose id (`{projectId}-{userId}`) is still kept.
async function cleanUpDeletedUsers({ projectId, userIds }: ClickhouseDeletion) {
  await dbUserIdentificationMap.deleteByUserIds(projectId, userIds);
  for (const userId of userIds) {
    const jobId = `${projectId}-${userId}`;
    if ((await createUserQueue.remove(jobId)) === 0 && (await createUserQueue.getJob(jobId))) {
      // Locked: it may write the user again.
      throw new Error(`create-user job ${jobId} is running`);
    }
    await invalidateIngestionUser(BigInt(projectId), BigInt(userId));
    await removeDeviceJobDeduplication(projectId, userId);
  }
}

/**
 * Deletes what the hub accepted before `deletedAt` but the worker wrote afterwards, keeping what a returning user
 * tracked since. Returns the ids of the failed deletions.
 */
async function repeatUserDeletions(deletions: ClickhouseDeletion[]) {
  if (deletions.length === 0) return [];
  try {
    await clickhouseDeletion.deleteUsers(
      deletions.map(({ id, projectId, userIds, deletedAt }) => {
        if (!deletedAt) throw new Error(`Deletion ${id} is not done yet`);
        return { projectId, userIds, before: deletedAt };
      }),
    );
  } catch (err) {
    const ids = deletions.map((deletion) => deletion.id);
    logger.error({ err, deletions: ids }, 'Failed to repeat the ClickHouse deletion of users');
    await dbClickhouseDeletion.markFailed(ids, String(err));
    return ids;
  }

  const done: string[] = [];
  const failed: string[] = [];
  for (const { id, projectId, userIds, deletedAt } of deletions) {
    try {
      for (const userId of userIds) {
        const jobId = `${projectId}-${userId}`;
        const job = await createUserQueue.getJob(jobId);
        if (job && job.timestamp < deletedAt!.getTime()) {
          if ((await createUserQueue.remove(jobId)) === 0 && (await createUserQueue.getJob(jobId))) {
            throw new Error(`create-user job ${jobId} is running`);
          }
          await invalidateIngestionUser(BigInt(projectId), BigInt(userId));
        }
      }
      done.push(id);
    } catch (err) {
      logger.error({ err, deletion: id }, 'Failed to clean up after repeating a user deletion');
      await dbClickhouseDeletion.markFailed([id], String(err));
      failed.push(id);
    }
  }
  if (done.length > 0) {
    await dbClickhouseDeletion.markRepeated(done);
  }
  return failed;
}

// Otherwise a visitor still browsing keeps the deleted session going, and its cached state is written back after the
// delete.
async function deleteUserSessionState(projectId: bigint, userId: bigint) {
  const currentSessionId = await stateRedis().getdel(sessionIdRedisKey(projectId, userId));
  const keys = await deleteBufferedUserSessions(projectId, userId, currentSessionId ? [currentSessionId] : []);
  if (keys.length > 0) {
    await flushSessionBuffer(keys.length, keys);
  }
}

export async function purgeDeletedRows() {
  if ((await dbClickhouseDeletion.countUnpurged()) === 0) return { purged: 0 };

  const startedAt = new Date();
  await clickhouseDeletion.applyDeletedMasks();
  const { count } = await dbClickhouseDeletion.markPurged(startedAt);
  logger.info({ purged: count }, 'Removed deleted ClickHouse rows physically');
  return { purged: count };
}

export async function initClickhouseDeletionWorker() {
  const queue = new Queue(clickhouseDeletionQueueName, { connection: defaultQueueConnection });
  try {
    // One scheduler per job plus global concurrency 1: exactly one replica runs it, never two at once.
    await queue.setGlobalConcurrency(1);
    const opts = { attempts: 1, removeOnComplete: 50, removeOnFail: 100 };
    await queue.upsertJobScheduler(
      `${clickhouseDeletionQueueName}-delete`,
      { pattern: '0 0 3 * * *' }, // every day at 03:00
      { name: 'delete', opts },
    );
    await queue.upsertJobScheduler(
      `${clickhouseDeletionQueueName}-purge`,
      { pattern: '0 0 5 * * 0' }, // every Sunday at 05:00, after that night's deletions
      { name: 'purge', opts },
    );
  } finally {
    await queue.close();
  }

  return new Worker(
    clickhouseDeletionQueueName,
    async (job: Job) => {
      switch (job.name) {
        case 'purge':
          return purgeDeletedRows();
        case DELETE_USERS_JOB:
          // Deletions queued from now on get the next job.
          await clickhouseDeletionQueue.removeDeduplicationKey(DELETE_USERS_DEDUPLICATION_ID);
          return deleteQueuedUsers();
        default:
          return deletePendingData();
      }
    },
    {
      connection: defaultQueueConnection,
      name: workerName,
      concurrency: 1,
      telemetry: queueTelemetry,
    },
  );
}
