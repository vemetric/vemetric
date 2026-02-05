import { createMiddleware } from 'hono/factory';
import type { PublicApiEnv } from './auth';
import { logger } from '../../utils/logger';

export const loggingMiddleware = createMiddleware<PublicApiEnv>(async (c, next) => {
  const start = Date.now();

  await next();

  const apiKey = c.get('apiKey');

  logger.info({
    type: 'api.request',
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    latencyMs: Date.now() - start,
    apiKeyId: apiKey?.id,
    projectId: apiKey?.projectId,
  });
});
