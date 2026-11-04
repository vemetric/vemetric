import type { MiddlewareHandler } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Bullboard can be protected in two ways (checked in this order):
 *
 * 1. Cloudflare Access: set CF_ACCESS_TEAM_DOMAIN (e.g. https://<team>.cloudflareaccess.com)
 *    and CF_ACCESS_AUD (the Access application's AUD tag). Every request must carry a valid
 *    `Cf-Access-Jwt-Assertion` token, so requests that bypass Cloudflare are rejected.
 * 2. Basic auth: set BULLBOARD_USERNAME and BULLBOARD_PASSWORD.
 *
 * Both apply to every path (UI, static assets and the /api routes that can modify jobs).
 * If neither is configured, startup fails.
 */
export function createAuthMiddleware(): MiddlewareHandler {
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.replace(/\/+$/, '');
  const audience = process.env.CF_ACCESS_AUD;

  if (teamDomain && audience) {
    const jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));

    return async (c, next) => {
      const token = c.req.header('cf-access-jwt-assertion');
      if (!token) {
        return c.text('Forbidden', 403);
      }

      try {
        await jwtVerify(token, jwks, { issuer: teamDomain, audience, algorithms: ['RS256'] });
      } catch {
        return c.text('Forbidden', 403);
      }

      await next();
    };
  }

  const username = process.env.BULLBOARD_USERNAME;
  const password = process.env.BULLBOARD_PASSWORD;

  if (username && password) {
    return basicAuth({ username, password });
  }

  throw new Error(
    'Bullboard auth is not configured: set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD, or BULLBOARD_USERNAME and BULLBOARD_PASSWORD',
  );
}
