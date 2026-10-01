import * as Sentry from '@sentry/bun';
import { closeQueues } from '@vemetric/queues/queue-utils';
import { clickhouseClient } from 'clickhouse';
import { prismaClient } from 'database';
import { app } from './app';
import { logger } from './utils/backend-logger';
import { closeRedisClient } from './utils/redis';

// The Vite dev server imports ./app directly, so only this entrypoint starts a server.
const server = Bun.serve({
  port: 4000,
  fetch: app.fetch,
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, closing server...`);
  try {
    // Resolves once in-flight requests are done, so they can still use the connections closed below.
    await server.stop();
    await closeQueues();
    await closeRedisClient();
    await Promise.all([prismaClient.$disconnect(), clickhouseClient.close(), Sentry.close(2000)]);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

logger.info('Starting app');
