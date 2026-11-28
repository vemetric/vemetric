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
