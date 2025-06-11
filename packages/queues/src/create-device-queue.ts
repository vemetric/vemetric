import { Queue } from 'bullmq';
import { createDeviceQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

export interface CreateDeviceQueueProps {
  projectId: string;
  userId: string;
  headers: Record<string, string>;
}

export const createDeviceQueue = new Queue<CreateDeviceQueueProps>(createDeviceQueueName, {
  connection: defaultQueueConnection,
});
createDeviceQueue.setGlobalConcurrency(1);
