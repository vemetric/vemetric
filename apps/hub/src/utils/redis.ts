import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;

export const getRedisClient = async () => {
  if (!redisClient) {
    try {
      redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      await redisClient.connect();
      redisClient.on('error', (err) => {
        logger.error({ err }, 'Redis client error');
        redisClient?.disconnect();
        redisClient = null;
      });
    } catch (err) {
      logger.error({ err }, 'Error connecting to Redis');
      redisClient = null;
    }
  }

  return redisClient;
};

const REDIS_USER_IDENTIFY_EXPIRATION = 60; // seconds
// used to make sure identification of a user is not done multiple at the same time
function getRedisUserIdentifyKey(projectId: bigint, identifier: string) {
  return `identification:${projectId}:${identifier}`;
}
export async function getUserIdentificationLock(projectId: bigint, identifier: string) {
  const redisClient = await getRedisClient();
  const redisKey = getRedisUserIdentifyKey(projectId, identifier);

  const lockAcquired =
    (await redisClient?.set(redisKey, '1', {
      NX: true,
      EX: REDIS_USER_IDENTIFY_EXPIRATION,
    })) ?? null;

  return { lockAcquired: Boolean(lockAcquired) };
}
export async function releaseUserIdentificationLock(projectId: bigint, identifier: string) {
  const redisClient = await getRedisClient();
  const redisKey = getRedisUserIdentifyKey(projectId, identifier);
  await redisClient?.del(redisKey);
}
