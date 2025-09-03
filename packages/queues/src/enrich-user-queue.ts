import { Queue } from 'bullmq';
import { enrichUserQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

export interface EnrichUserQueueProps {
  projectId: string;
  userId: string;
}

export const enrichUserQueue = new Queue<EnrichUserQueueProps>(enrichUserQueueName, {
  connection: defaultQueueConnection,
});