import Redis from 'ioredis';
import { registerIngestionCommands, type IngestionCommands } from './session-redis-commands';
import { registerUserCommands, type UserCommands } from './user-redis-commands';
import { logger } from '../utils/logger';

let client: (Redis & IngestionCommands & UserCommands) | undefined;
export function stateRedis() {
  if (!client) {
    client = registerUserCommands(
      registerIngestionCommands(
        new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 3 }),
      ),
    );
    client.on('error', (err) => logger.error({ err }, 'Ingestion Redis error'));
  }
  return client;
}

export async function closeStateRedis() {
  if (client) {
    try {
      await client.quit();
    } catch {
      // Never mask the caller's error if the connection already failed or closed.
      client.disconnect();
    }
  }
  client = undefined;
}
