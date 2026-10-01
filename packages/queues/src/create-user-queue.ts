import type { GeoData } from '@vemetric/common/geo';
import { createUserQueueName } from './queue-names';
import { createQueue } from './queue-utils';

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

export const createUserQueue = createQueue<CreateUserQueueProps>(createUserQueueName);
createUserQueue.setGlobalConcurrency(1);
