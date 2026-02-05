import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { errorHandler } from './lib/errors';
import { authMiddleware, type PublicApiEnv } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { pingRoute } from './routes/ping';

export function createPublicApi() {
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

  // Docs — mounted outside /v1/* so no auth required
  api.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Vemetric API',
      version: '1.0.0',
      description: 'Privacy-first analytics API (read-only)',
    },
    security: [{ bearerAuth: [] }],
  });

  api.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'API key (e.g. vem_...)',
  });

  api.get('/docs', swaggerUI({ url: '/api/openapi.json' }));

  // Middleware stack for /v1/* (order matters)
  api.use('/v1/*', loggingMiddleware);
  api.use('/v1/*', authMiddleware);
  api.use('/v1/*', rateLimitMiddleware);

  // Routes
  api.route('/v1', pingRoute);

  // Global error handler
  api.onError(errorHandler);

  return api;
}
