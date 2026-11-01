import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';
import { createRateLimitMiddleware, createRateLimitPolicyMiddleware } from './middleware/rate-limit';
import { API_DOCS_URL, registerOpenApiDocs } from './openapi';
import { registerAnalyticsRoutes } from './routes/analytics';
import { registerFilterValueRoutes } from './routes/filter-values';
import { registerFunnelRoutes } from './routes/funnels';
import { registerProjectRoutes } from './routes/projects';
import { registerUserRoutes } from './routes/users';
import type { PublicApiHonoEnv } from './types';
import { createErrorBody, createValidationErrorResponse, errorHandler } from './utils/errors';

export { API_DOCS_URL };

export function createPublicApi() {
  const rateLimitMiddleware = createRateLimitMiddleware();

  const api = new OpenAPIHono<PublicApiHonoEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(createValidationErrorResponse(result.error.issues), 400);
      }
    },
  });

  registerOpenApiDocs(api);

  api.get('/', (c) => c.redirect(API_DOCS_URL, 302));
  api.get('/docs', (c) => c.redirect(API_DOCS_URL, 302));

  if (process.env.NODE_ENV !== 'test') {
    api.use('/v1/*', loggingMiddleware);
  }
  api.use('/v1/*', createRateLimitPolicyMiddleware());
  api.use('/v1/*', authMiddleware);
  api.use('/v1/*', rateLimitMiddleware);

  registerProjectRoutes(api);
  registerAnalyticsRoutes(api);
  registerFilterValueRoutes(api);
  registerUserRoutes(api);
  registerFunnelRoutes(api);

  api.notFound((c) => {
    return c.json(createErrorBody('NOT_FOUND', 'Route not found. See https://vemetric.com/docs/api'), 404);
  });

  api.onError(errorHandler);

  return api;
}
