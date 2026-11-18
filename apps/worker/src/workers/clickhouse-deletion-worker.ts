import { clickhouseDeletionQueueName } from '@vemetric/queues/queue-names';
import { defaultQueueConnection } from '@vemetric/queues/queue-utils';
import { Queue, Worker } from 'bullmq';
import { clickhouseDeletion } from 'clickhouse';
import { dbClickhouseDeletion } from 'database';
import { workerName } from '../utils/env';
import { logger } from '../utils/logger';
import { queueTelemetry } from '../utils/telemetry';

// Deletes queued ClickHouse data (ClickhouseDeletion rows: deleted projects, users of deleted accounts) when traffic is
// low. Postgres is deleted right away, so the data is no longer reachable in the meantime.
//
// - `delete`, every night: lightweight deletes for everything queued at least an hour ago. The hour lets queued jobs
//   and cached sessions of a deleted project finish writing first.
// - `purge`, every Sunday after the nightly run: removes the deleted rows physically (`APPLY DELETED MASK`), batched
//   for the whole week, so personal data is gone well within a month.
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
      await clickhouseDeletion.deleteProjectUsers(deletion.projectId, deletion.userIds);
      await dbClickhouseDeletion.markDeleted([deletion.id]);
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
    async (job) => (job.name === 'purge' ? purgeDeletedRows() : deletePendingData()),
    {
      connection: defaultQueueConnection,
      name: workerName,
      concurrency: 1,
      telemetry: queueTelemetry,
    },
  );
}
