import { createMiddleware } from 'hono/factory';
import { API_DOCS_URL } from '../openapi';
import type { PublicApiHonoEnv } from '../types';

export type DeprecationOptions = {
  /** When the endpoint was (or will be) deprecated. */
  deprecatedAt: Date;
  /** When the endpoint will be removed. Per our policy at least 3 months after the announcement. */
  sunsetAt: Date;
  /** Page describing the deprecation and the migration path. Defaults to the API docs. */
  link?: string;
};

/**
 * Sends the `Deprecation` (RFC 9745), `Sunset` (RFC 8594) and `Link: rel="deprecation"` headers.
 */
export function createDeprecationMiddleware({ deprecatedAt, sunsetAt, link = API_DOCS_URL }: DeprecationOptions) {
  const deprecation = `@${Math.floor(deprecatedAt.getTime() / 1000)}`;
  const sunset = sunsetAt.toUTCString();
  const linkHeader = `<${link}>; rel="deprecation"; type="text/html"`;

  return createMiddleware<PublicApiHonoEnv>(async (c, next) => {
    c.header('Deprecation', deprecation);
    c.header('Sunset', sunset);
    c.header('Link', linkHeader, { append: true });
    await next();
  });
}

/**
 * Marks a route as deprecated: spread the result into `createRoute({ ... })`.
 * The operation is flagged `deprecated: true` in the OpenAPI spec and its responses carry the deprecation headers.
 *
 * @example
 * const route = createRoute({ method: 'get', path: '/v1/old', ...deprecateRoute({ deprecatedAt, sunsetAt }), ... });
 */
export function deprecateRoute(options: DeprecationOptions) {
  return {
    deprecated: true as const,
    middleware: [createDeprecationMiddleware(options)],
  };
}
