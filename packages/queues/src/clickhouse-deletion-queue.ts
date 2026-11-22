import { Queue } from 'bullmq';
import { clickhouseDeletionQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

/** Jobs of the worker's clickhouse-deletion-worker. */
export const clickhouseDeletionQueue = new Queue(clickhouseDeletionQueueName, {
  connection: defaultQueueConnection,
});

export const DELETE_USERS_JOB = 'delete-users';

export const DELETE_USERS_DEDUPLICATION_ID = DELETE_USERS_JOB;

// Lets events the hub accepted before the deletion be written first.
const DELETE_USERS_DELAY_MS = 2 * 60 * 1000;

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
