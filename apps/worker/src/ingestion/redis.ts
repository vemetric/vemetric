import { createLogger } from '@vemetric/logger';
import { assertIngestionSchema, clickhouseClient } from 'clickhouse';
import Redis from 'ioredis';
import { registerIngestionCommands, type IngestionCommands } from './session-redis-commands';

const logger = createLogger('ingestion-state');

export function positiveStateInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    logger.error(`Environment variable ${name} must be a positive integer, but got: ${process.env[name]}`);
    return fallback;
  }
  return value;
}

let client: (Redis & IngestionCommands) | undefined;
export function stateRedis() {
  if (!client) {
    client = registerIngestionCommands(
      new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 3 }),
    );
    client.on('error', (err) => logger.error({ err }, 'Ingestion Redis error'));
  }
  return client;
}

export async function assertIngestionStateStorage() {
  await stateRedis().ping();
  await assertIngestionSchema(clickhouseClient);
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
