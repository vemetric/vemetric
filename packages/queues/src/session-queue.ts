import { Queue } from 'bullmq';
import type { GeoData } from 'clickhouse';
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
  ipAddress?: string; // TODO: only here for backwards compatibility, remove later
  geoData: GeoData | undefined;
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
