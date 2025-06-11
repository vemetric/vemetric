import { Queue } from 'bullmq';
import { mergeUserQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

export interface MergeUserQueueProps {
  projectId: string;
  oldUserId: string;
  newUserId: string;
  displayName?: string;
}

export const mergeUserQueue = new Queue<MergeUserQueueProps>(mergeUserQueueName, {
  connection: defaultQueueConnection,
});
