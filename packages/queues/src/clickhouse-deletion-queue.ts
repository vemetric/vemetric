import { Queue } from 'bullmq';
import { clickhouseDeletionQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

/**
 * Jobs of the worker's clickhouse-deletion-worker: the scheduled `delete` (nightly) and `purge` (weekly), plus
 * `delete-users` for a single queued user deletion that should not wait for the night.
 */
export const clickhouseDeletionQueue = new Queue(clickhouseDeletionQueueName, {
  connection: defaultQueueConnection,
});

export const DELETE_USERS_JOB = 'delete-users';
export type DeleteUsersJobData = { deletionId: string };

// Leaves time for events the hub accepted before the deletion to be written first.
const DELETE_USERS_DELAY_MS = 2 * 60 * 1000;

/**
 * Runs a queued user deletion (ClickhouseDeletion row) in a few minutes instead of the next night. If it keeps
 * failing, the deletion stays pending and the nightly run tries again.
 */
export const queueUserDeletionJob = (deletionId: string) =>
  clickhouseDeletionQueue.add(DELETE_USERS_JOB, { deletionId } satisfies DeleteUsersJobData, {
    jobId: `${DELETE_USERS_JOB}-${deletionId}`,
    delay: DELETE_USERS_DELAY_MS,
    attempts: 3,
    backoff: { type: 'exponential', delay: 60 * 1000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  });
