import { Queue } from 'bullmq';
import { clickhouseDeletionQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

/** Scheduled jobs only (`delete` nightly, `purge` weekly), see the worker's clickhouse-deletion-worker. */
export const clickhouseDeletionQueue = new Queue(clickhouseDeletionQueueName, {
  connection: defaultQueueConnection,
});
