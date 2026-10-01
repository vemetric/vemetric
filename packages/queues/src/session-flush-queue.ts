import { sessionFlushQueueName } from './queue-names';
import { createQueue } from './queue-utils';

// Scheduled by the session flush worker; exported so it can be monitored (e.g. in Bullboard).
export const sessionFlushQueue = createQueue(sessionFlushQueueName);
