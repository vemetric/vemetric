import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';
import { createRateLimitMiddleware } from './middleware/rate-limit';
import { pingRoute } from './routes/ping';
import type { PublicApiEnv } from './types';
import { errorHandler } from './utils/errors';

export function createPublicApi() {
  const rateLimitMiddleware = createRateLimitMiddleware();

  const api = new OpenAPIHono<PublicApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request parameters',
              details: result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
              })),
            },
          },
          422,
        );
      }
    },
  });

  api.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Vemetric API',
      version: '1.0.0',
      description: 'Privacy-first analytics API (read-only)',
    },
  });

  api.get('/docs', (c) => c.redirect('https://vemetric.com/docs/api', 302));

  api.use('/v1/*', loggingMiddleware);
  api.use('/v1/*', authMiddleware);
  api.use('/v1/*', rateLimitMiddleware);

  api.route('/v1', pingRoute);

  api.notFound((c) => {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
        },
      },
      404,
    );
  });

  api.onError(errorHandler);

  return api;
}
