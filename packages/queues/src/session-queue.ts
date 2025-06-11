import { Queue } from 'bullmq';
import { sessionQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

interface BaseProps {
  projectId: string;
  userId: string;
  sessionId: string;
  createdAt: string;
}

interface CreateOrExtendProps extends BaseProps {
  type: 'createOrExtend';
  ipAddress: string;
  headers: Record<string, string>;
  url?: string;
  reqIdentifier?: string;
  reqDisplayName?: string;
}

interface ExtendOnlyProps extends BaseProps {
  type: 'extend';
}

export type SessionQueueProps = CreateOrExtendProps | ExtendOnlyProps;

export const sessionQueue = new Queue<SessionQueueProps>(sessionQueueName, {
  connection: defaultQueueConnection,
});
sessionQueue.setGlobalConcurrency(1);
