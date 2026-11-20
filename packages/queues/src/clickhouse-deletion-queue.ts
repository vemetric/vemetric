import { Queue } from 'bullmq';
import { clickhouseDeletionQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

/**
 * Jobs of the worker's clickhouse-deletion-worker: the scheduled `delete` (nightly) and `purge` (weekly), plus
 * `delete-users` for user deletions that should not wait for the night.
 */
export const clickhouseDeletionQueue = new Queue(clickhouseDeletionQueueName, {
  connection: defaultQueueConnection,
});

export const DELETE_USERS_JOB = 'delete-users';

/**
 * One `delete-users` job at a time is waiting: further deletions join it. The worker removes this key when the job
 * starts, so deletions queued while it runs get the next one.
 */
export const DELETE_USERS_DEDUPLICATION_ID = DELETE_USERS_JOB;

// Leaves time for events the hub accepted before the deletion to be written first, and for more deletions to join.
const DELETE_USERS_DELAY_MS = 2 * 60 * 1000;

/**
 * Runs the queued user deletions (ClickhouseDeletion rows) in a few minutes instead of the next night, all in one
 * batch: deleting many users one after another costs about as much as deleting one. If it keeps failing, the
 * deletions stay pending and the nightly run tries again.
 */
export const queueUserDeletionJob = () =>
  clickhouseDeletionQueue.add(
    DELETE_USERS_JOB,
    {},
    {
      deduplication: { id: DELETE_USERS_DEDUPLICATION_ID },
      delay: DELETE_USERS_DELAY_MS,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60 * 1000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
