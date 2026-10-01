import { createDeviceQueueName } from './queue-names';
import { createQueue } from './queue-utils';

export interface CreateDeviceQueueProps {
  projectId: string;
  userId: string;
  headers: Record<string, string>;
}

export const createDeviceQueue = createQueue<CreateDeviceQueueProps>(createDeviceQueueName);
