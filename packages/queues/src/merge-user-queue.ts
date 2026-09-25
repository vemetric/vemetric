import { Queue } from 'bullmq';
import { mergeUserQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

export interface MergeUserQueueProps {
  projectId: string;
  oldUserId: string;
  newUserId: string;
  displayName?: string;
  // The old user's session the hub handed over to the new user; the merge must keep it.
  continuedSessionId?: string;
  // First readiness postponement, persisted so worker restarts do not reset the deadline.
  sessionWaitStartedAt?: number;
}

export const mergeUserQueue = new Queue<MergeUserQueueProps>(mergeUserQueueName, {
  connection: defaultQueueConnection,
});
