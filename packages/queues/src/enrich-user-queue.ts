import { enrichUserQueueName } from './queue-names';
import { createQueue } from './queue-utils';

export interface EnrichUserQueueProps {
  projectId: string;
  userId: string;
}

export const enrichUserQueue = createQueue<EnrichUserQueueProps>(enrichUserQueueName);