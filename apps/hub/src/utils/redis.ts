import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | undefined;

export const getRedisClient = async (): Promise<RedisClientType> => {
  if (connecting) return connecting;
  if (redisClient) return redisClient;
  const client: RedisClientType = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', (err) => logger.error({ err }, 'Redis client error'));
  connecting = client
    .connect()
    .then(() => {
      redisClient = client;
      return client;
    })
    .catch((err: unknown) => {
      if (client.isOpen) void client.disconnect();
      throw err;
    })
    .finally(() => {
      connecting = undefined;
    });
  return connecting;
};

export async function closeRedisClient() {
  const client = redisClient ?? (await connecting?.catch(() => null));
  redisClient = null;
  if (client?.isOpen) {
    await client.quit();
  }
}

const REDIS_USER_IDENTIFY_EXPIRATION = 60; // seconds
// used to make sure identification of a user is not done multiple at the same time
function getRedisUserIdentifyKey(projectId: bigint, identifier: string) {
  return `identification:${projectId}:${identifier}`;
}
export async function getUserIdentificationLock(projectId: bigint, identifier: string) {
  const redisClient = await getRedisClient();
  const redisKey = getRedisUserIdentifyKey(projectId, identifier);

  const lockAcquired = await redisClient.set(redisKey, '1', {
    NX: true,
    EX: REDIS_USER_IDENTIFY_EXPIRATION,
  });

  return { lockAcquired: Boolean(lockAcquired) };
}
// Waits for a running identification of the same identifier to finish, then takes the lock.
export async function waitForUserIdentificationLock(projectId: bigint, identifier: string, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (true) {
    const result = await getUserIdentificationLock(projectId, identifier);
    if (result.lockAcquired || Date.now() - startedAt >= timeoutMs) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function releaseUserIdentificationLock(projectId: bigint, identifier: string) {
  const redisClient = await getRedisClient();
  const redisKey = getRedisUserIdentifyKey(projectId, identifier);
  await redisClient.del(redisKey);
}
