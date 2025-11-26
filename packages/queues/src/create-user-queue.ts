import { Queue } from 'bullmq';
import type { GeoData } from 'clickhouse';
import { createUserQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

export interface CreateUserQueueProps {
  projectId: string;
  userId: string;
  createdAt: string;
  ipAddress?: string; // TODO: only here for backwards compatibility, remove later
  geoData: GeoData | undefined;
  identifier: string;
  displayName: string;
  avatarUrl?: string;
  data: Record<string, any>;
}

export const createUserQueue = new Queue<CreateUserQueueProps>(createUserQueueName, {
  connection: defaultQueueConnection,
});
createUserQueue.setGlobalConcurrency(1);
