import { Queue } from 'bullmq';
import type { GeoData } from 'clickhouse';
import { eventQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

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
  reqIdentifier?: string;
  reqDisplayName?: string;
  ipAddress?: string; // TODO: only here for backwards compatibility, remove later
  geoData: GeoData | undefined;
}

export const eventQueue = new Queue<EventQueueProps>(eventQueueName, {
  connection: defaultQueueConnection,
});
