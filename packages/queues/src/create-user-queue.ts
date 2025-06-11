import { Queue } from 'bullmq';
import { createUserQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

export interface CreateUserQueueProps {
  projectId: string;
  userId: string;
  createdAt: string;
  ipAddress: string;
  identifier: string;
  displayName: string;
  data: Record<string, any>;
}

export const createUserQueue = new Queue<CreateUserQueueProps>(createUserQueueName, {
  connection: defaultQueueConnection,
});
createUserQueue.setGlobalConcurrency(1);
