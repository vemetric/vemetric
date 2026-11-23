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

export const deviceJobDeduplicationId = (projectId: bigint | string, userId: bigint | string, fingerprint: string) =>
  `${projectId}:${userId}:${fingerprint}`;

export async function removeDeviceJobDeduplication(projectId: bigint | string, userId: bigint | string) {
  const prefix = `${createDeviceQueue.qualifiedName}:de:`;
  const client = await createDeviceQueue.client;
  const stream = client.scanStream({ match: `${prefix}${deviceJobDeduplicationId(projectId, userId, '*')}`, count: 1000 });
  for await (const keys of stream as AsyncIterable<string[]>) {
    for (const key of keys) {
      await createDeviceQueue.removeDeduplicationKey(key.slice(prefix.length));
    }
  }
}
