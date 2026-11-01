import { createMiddleware } from 'hono/factory';
import type { PublicApiHonoEnv } from '../types';
import { PROJECT_HEADER, resolveApiKeyProject } from '../utils/api-key-access';

/** Sets the project the request is about, from the API key and the `X-Vemetric-Project` header. */
export const projectMiddleware = createMiddleware<PublicApiHonoEnv>(async (c, next) => {
  const requestedProjectId = c.req.header(PROJECT_HEADER)?.trim() || undefined;
  c.set('project', await resolveApiKeyProject(c.var.apiKey, requestedProjectId));
  await next();
});
