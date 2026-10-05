import { prismaClient } from 'database';
import { app } from './app';
import { logger } from './utils/logger';
import { closeRedisClient } from './utils/redis';

// Tests import ./app directly, so only this entrypoint starts a server.
const server = Bun.serve({
  port: 4004,
  fetch: app.fetch,
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, closing server...`);
  try {
    // Resolves once in-flight requests are done, so they can still use the connections closed below.
    await server.stop();
    await closeRedisClient();
    await prismaClient.$disconnect();
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

logger.info('Starting hub');
