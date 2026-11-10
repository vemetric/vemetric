import { oauthProviderAuthServerMetadata } from '@better-auth/oauth-provider';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from '../utils/auth';

/**
 * OAuth discovery for MCP clients, at the domain root where they look for it:
 * - `/.well-known/oauth-protected-resource[/mcp]` (RFC 9728) names the authorization server of the MCP server.
 * - `/.well-known/oauth-authorization-server[/_api/auth]` (RFC 8414) describes it. The issuer has the auth base path,
 *   so clients try the path-inserted form first; some only try the root.
 *
 * The OAuth plugin answers the path-inserted forms itself before routing, so they're handed to the auth handler.
 */
export function createOauthDiscoveryApp() {
  const app = new Hono();
  app.use('*', cors({ origin: '*' }));

  const authServerMetadata = oauthProviderAuthServerMetadata(auth);
  app.on(['GET', 'HEAD'], '/oauth-authorization-server', (c) => authServerMetadata(c.req.raw));

  app.on(['GET', 'HEAD'], '/oauth-authorization-server/*', (c) => auth.handler(c.req.raw));
  app.on(['GET', 'HEAD'], '/oauth-protected-resource', (c) => auth.handler(c.req.raw));
  app.on(['GET', 'HEAD'], '/oauth-protected-resource/*', (c) => auth.handler(c.req.raw));

  return app;
}
