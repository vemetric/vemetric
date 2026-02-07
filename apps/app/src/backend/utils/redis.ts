import { createClient } from 'redis';
import { logger } from './backend-logger';

type RedisNativeClient = ReturnType<typeof createClient>;

let redisClient: RedisNativeClient | null = null;
let redisClientPromise: Promise<RedisNativeClient> | null = null;

export function getRedisClient() {
  if (redisClient) {
    return Promise.resolve(redisClient);
  }

  if (redisClientPromise) {
    return redisClientPromise;
  }

  const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

  redisClientPromise = client
    .connect()
    .then(() => {
      client.on('error', (err) => {
        logger.error({ err }, 'Redis client error');
        if (redisClient) {
          void redisClient.disconnect().catch(() => {
            // Best effort cleanup - connection may already be closed.
          });
        }
        redisClient = null;
        redisClientPromise = null;
      });

      redisClient = client;
      return client;
    })
    .catch((err) => {
      logger.error({ err }, 'Error connecting to Redis');
      redisClient = null;
      redisClientPromise = null;
      throw err;
    });

  return redisClientPromise;
}
