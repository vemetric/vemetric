import { sessionIdRedisKey } from '@vemetric/common/session';
import { DELETE_USERS_JOB, type DeleteUsersJobData } from '@vemetric/queues/clickhouse-deletion-queue';
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
//   and cached sessions of a deleted project finish writing first.
// - `purge`, every Sunday after the nightly run: removes the deleted rows physically (`APPLY DELETED MASK`), batched
//   for the whole week, so personal data is gone well within a month.
// - `delete-users`, a few minutes after a single user was deleted in the app (see queueUserDeletionJob), so the user
//   does not stay visible until the night.
//
// Failed deletions keep `deletedAt` empty and are tried again the next night.

export const PENDING_MIN_AGE_MS = 60 * 60 * 1000;

export async function deletePendingData() {
  const pending = await dbClickhouseDeletion.findPending(PENDING_MIN_AGE_MS);
  if (pending.length === 0) return { deleted: 0, failed: 0 };

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

  for (const deletion of pending.filter((deletion) => deletion.userIds.length > 0)) {
    try {
      await deleteUsers(deletion);
    } catch (err) {
      logger.error({ err, deletion: deletion.id }, 'Failed to delete ClickHouse data of users');
      await dbClickhouseDeletion.markFailed([deletion.id], String(err));
      failed.push(deletion.id);
    }
  }

  const result = { deleted: pending.length - failed.length, failed: failed.length };
  logger.info(result, 'Deleted queued ClickHouse data');
  if (failed.length > 0) {
    // Fails the job so it shows up in the dashboard; the deletions are tried again the next night.
    throw new Error(`${failed.length} ClickHouse deletion(s) failed: ${failed.join(', ')}`);
  }
  return result;
}

/**
 * Deletes the users' rows, then everything that still points to their user ids. A deleted user can come back with
 * the same user id (the `_vuid` cookie) and identify again; that has to create them from scratch:
 * - an identification entry recreated in the meantime would now point to a user row that is gone,
 * - the completed create-user job (job id `{projectId}-{userId}`) would make BullMQ drop the new one,
 * - the ingestion user cache would tag new events with the deleted user's identifier and name,
 * - the device cache and the hub's create-device job deduplication would skip writing their device again.
 * Buffered sessions are cleared before the delete instead, so their old data can't be written after it.
 */
async function deleteUsers(deletion: ClickhouseDeletion) {
  const { projectId, userIds } = deletion;
  for (const userId of userIds) {
    await deleteUserSessionState(BigInt(projectId), BigInt(userId));
  }
  const devices = await clickhouseDeletion.findProjectUserDevices(projectId, userIds);
  await clickhouseDeletion.deleteProjectUsers(projectId, userIds);

  await dbUserIdentificationMap.deleteByUserIds(projectId, userIds);
  for (const userId of userIds) {
    const jobId = `${projectId}-${userId}`;
    if ((await createUserQueue.remove(jobId)) === 0 && (await createUserQueue.getJob(jobId))) {
      // Locked: it is being processed right now and may write the user again. Try again later.
      throw new Error(`create-user job ${jobId} is running`);
    }
    await invalidateIngestionUser(BigInt(projectId), BigInt(userId));
    await removeDeviceJobDeduplication(projectId, userId);
  }
  if (devices.length > 0) {
    await stateRedis().del(...devices.map((device) => deviceWrittenKey(projectId, device.userId, device.id)));
  }

  await dbClickhouseDeletion.markDeleted([deletion.id]);
}

/**
 * The hub sends a visitor's events to their current session for 30 minutes, and the worker caches sessions while they
 * are written. A visitor still browsing would keep the deleted session going: drop the hub's session id so new events
 * start a new session, and write deletion tombstones for the buffered sessions now (the ClickHouse delete removes them
 * too).
 */
async function deleteUserSessionState(projectId: bigint, userId: bigint) {
  const currentSessionId = await stateRedis().getdel(sessionIdRedisKey(projectId, userId));
  const keys = await deleteBufferedUserSessions(projectId, userId, currentSessionId ? [currentSessionId] : []);
  if (keys.length > 0) {
    await flushSessionBuffer(keys.length, keys);
  }
}

/** A single queued user deletion, see queueUserDeletionJob. Skips it when the nightly run got there first. */
export async function deleteQueuedUsers(deletionId: string) {
  const deletion = await dbClickhouseDeletion.findById(deletionId);
  if (!deletion || deletion.deletedAt || deletion.userIds.length === 0) return { deleted: 0 };

  try {
    await deleteUsers(deletion);
  } catch (err) {
    logger.error({ err, deletion: deletion.id }, 'Failed to delete ClickHouse data of users');
    await dbClickhouseDeletion.markFailed([deletion.id], String(err));
    throw err;
  }
  logger.info({ deletion: deletion.id, projectId: deletion.projectId }, 'Deleted ClickHouse data of users');
  return { deleted: 1 };
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
          return deleteQueuedUsers((job.data as DeleteUsersJobData).deletionId);
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
