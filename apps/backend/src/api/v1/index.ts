import { Hono } from 'hono';
import type { ApiContextVars } from './types';
import { apiKeyAuth } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { createOverviewRoutes } from './routes/overview';
import { createPagesRoutes } from './routes/pages';
import { createSourcesRoutes } from './routes/sources';
import { createCountriesRoutes } from './routes/countries';
import { createUsersRoutes } from './routes/users';
import { createFunnelsRoutes } from './routes/funnels';
import { createEventsRoutes } from './routes/events';
import { createDevicesRoutes } from './routes/devices';

export function createApiV1Router() {
  const api = new Hono<{ Variables: ApiContextVars }>();

  // Apply authentication and rate limiting to all routes
  api.use('/:projectId/*', apiKeyAuth);
  api.use('/:projectId/*', rateLimitMiddleware);

  // Register all routes under /:projectId prefix
  const projectApi = new Hono<{ Variables: ApiContextVars }>();

  // Core stats endpoints
  createOverviewRoutes(projectApi);
  createPagesRoutes(projectApi);
  createSourcesRoutes(projectApi);
  createCountriesRoutes(projectApi);
  createDevicesRoutes(projectApi);

  // User endpoints
  createUsersRoutes(projectApi);

  // Advanced endpoints
  createFunnelsRoutes(projectApi);
  createEventsRoutes(projectApi);

  // Mount all project routes
  api.route('/:projectId', projectApi);

  // Health check for API
  api.get('/health', (c) => {
    return c.json({ status: 'ok', version: 'v1' });
  });

  return api;
}
