import type { GeoData } from '@vemetric/common/geo';
import { eventQueueName } from './queue-names';
import { createQueue } from './queue-utils';

export interface EventQueueProps {
  projectId: string;
  userId: string;
  eventId: string;
  sessionId: string;
  contextId?: string;
  createdAt: string;
  name: string;
  headers: Record<string, string>;
  customData?: Record<string, unknown>;
  url?: string;
  projectDomain?: string;
  reqIdentifier?: string;
  reqDisplayName?: string;
  ipAddress?: string; // TODO: only here for backwards compatibility, remove later
  geoData: GeoData | undefined;
}

export const eventQueue = createQueue<EventQueueProps>(eventQueueName);
