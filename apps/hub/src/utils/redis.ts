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
