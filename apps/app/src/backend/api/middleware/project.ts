import { createMiddleware } from 'hono/factory';
import type { PublicApiHonoEnv } from '../types';
import { PROJECT_HEADER, projectRequiredError, resolveApiKeyProject } from '../utils/api-key-access';
import { ApiError } from '../utils/errors';

/**
 * Sets the project the request names: a project key's own project, or the project in the `X-Vemetric-Project`
 * header for an organization key. A failed lookup (`PROJECT_NOT_FOUND`) is only stored, so the request still
 * counts against the key's rate-limit bucket; `projectErrorMiddleware` throws it after the rate limiter.
 */
export const projectMiddleware = createMiddleware<PublicApiHonoEnv>(async (c, next) => {
  const requestedProjectId = c.req.header(PROJECT_HEADER)?.trim() || undefined;
  try {
    const project = await resolveApiKeyProject(c.var.apiKey, requestedProjectId);
    if (project) {
      c.set('project', project);
    }
  } catch (err) {
    if (!(err instanceof ApiError)) {
      throw err;
    }
    c.set('projectError', err);
  }
  await next();
});

/** Throws the error of a failed project lookup. Registered after the rate limiter. */
export const projectErrorMiddleware = createMiddleware<PublicApiHonoEnv>(async (c, next) => {
  const projectError = c.get('projectError');
  if (projectError) {
    throw projectError;
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
