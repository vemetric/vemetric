import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { PublicApiEnv } from '../types';
import { logger } from '../utils/api-logger';

export const loggingMiddleware = createMiddleware<PublicApiEnv>(async (c, next) => {
  const start = Date.now();
  let status = 200;

  try {
    await next();
    status = c.res.status;
  } catch (error) {
    if (error instanceof HTTPException) {
      status = error.status;
    } else {
      status = 500;
    }

    throw error;
  } finally {
    const apiKey = c.get('apiKey');

    logger.info({
      type: 'api.request',
      method: c.req.method,
      path: c.req.path,
      status,
      latencyMs: Date.now() - start,
      apiKeyId: apiKey?.id,
      projectId: apiKey?.projectId,
    });
  }
});
