import { createMiddleware } from 'hono/factory';
import type { PublicApiHonoEnv } from '../types';
import { PROJECT_HEADER, projectRequiredError, resolveApiKeyProject } from '../utils/api-key-access';

/**
 * Sets the project the request names: a project key's own project, or the project in the `X-Vemetric-Project`
 * header for an organization key.
 */
export const projectMiddleware = createMiddleware<PublicApiHonoEnv>(async (c, next) => {
  const requestedProjectId = c.req.header(PROJECT_HEADER)?.trim() || undefined;
  const project = await resolveApiKeyProject(c.var.apiKey, requestedProjectId);
  if (project) {
    c.set('project', project);
  }
  await next();
});

/** Route middleware of every endpoint that is about one project. */
export const requireProject = createMiddleware<PublicApiHonoEnv>(async (c, next) => {
  if (!c.var.project) {
    throw projectRequiredError();
  }
  await next();
});
