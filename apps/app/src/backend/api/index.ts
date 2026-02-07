import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';
import { createRateLimitMiddleware } from './middleware/rate-limit';
import { pingRoute } from './routes/ping';
import type { PublicApiEnv } from './types';
import { createValidationErrorResponse, errorHandler } from './utils/errors';

export function createPublicApi() {
  const rateLimitMiddleware = createRateLimitMiddleware();

  const api = new OpenAPIHono<PublicApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(createValidationErrorResponse(result.error.issues), 422);
      }
    },
  });

  api.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Vemetric API',
      version: '1.0.0',
      description: 'Privacy-first analytics API',
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
          message: 'Route not found. See https://vemetric.com/docs/api',
        },
      },
      404,
    );
  });

  api.onError(errorHandler);

  return api;
}
