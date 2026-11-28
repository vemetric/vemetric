import { Queue } from 'bullmq';
import { sessionFlushQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

// Scheduled by the session flush worker; exported so it can be monitored (e.g. in Bullboard).
export const sessionFlushQueue = new Queue(sessionFlushQueueName, {
  connection: defaultQueueConnection,
});
