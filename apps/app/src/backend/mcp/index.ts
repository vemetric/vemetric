import { createMcpHandler } from '@modelcontextprotocol/server';
import { getMcpUrl } from '@vemetric/common/env';
import { Hono } from 'hono';
import { getCaller, toAuthInfo, type McpCaller } from './caller';
import { authenticateOauthToken, isOauthAccessToken, McpAuthError } from './oauth';
import { createVemetricMcpServer } from './server';
import { authenticateApiKey } from '../api/middleware/auth';
import { logger } from '../api/utils/api-logger';
import { ApiError } from '../api/utils/errors';
import { MCP_SCOPE } from '../utils/oauth-consts';

/** Where MCP clients find the authorization server (RFC 9728), path-inserted like `/.well-known/…/mcp`. */
export function getProtectedResourceMetadataUrl(): string {
  const mcpUrl = new URL(getMcpUrl());
  return `${mcpUrl.origin}/.well-known/oauth-protected-resource${mcpUrl.pathname.replace(/\/$/, '')}`;
}

function quote(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

/**
 * A `401`/`403` with an RFC 6750 challenge that points clients to the OAuth discovery. Requests without credentials
 * get no `error` (the client starts the OAuth flow), rejected credentials `invalid_token` or `insufficient_scope`.
 */
function challenge(rejection?: { error: 'invalid_token' | 'insufficient_scope'; message: string }) {
  const params = [`resource_metadata=${quote(getProtectedResourceMetadataUrl())}`, `scope=${quote(MCP_SCOPE)}`];
  if (rejection) {
    params.push(`error=${quote(rejection.error)}`, `error_description=${quote(rejection.message)}`);
  }

  const status = rejection?.error === 'insufficient_scope' ? 403 : 401;
  const message = rejection?.message ?? 'Authorization required: connect with OAuth or use an API key.';
  return Response.json(
    { error: { code: 'UNAUTHORIZED', message } },
    { status, headers: { 'WWW-Authenticate': `Bearer ${params.join(', ')}` } },
  );
}

/** Tells API keys (`vem_…`) and OAuth access tokens apart; both arrive as `Authorization: Bearer …`. */
async function authenticate(authorization: string): Promise<McpCaller> {
  const token = authorization.slice('Bearer '.length).trim();
  if (isOauthAccessToken(token)) {
    return { kind: 'oauth', ...(await authenticateOauthToken(token)) };
  }
  return { kind: 'apiKey', ...(await authenticateApiKey(authorization)) };
}

/**
 * The MCP server, mounted at `/mcp`. Stateless: every HTTP request gets a fresh server instance for its caller, which
 * serves both 2026-07-28 clients and 2025-era clients.
 */
export function createMcpApp() {
  const handler = createMcpHandler(({ authInfo }) => createVemetricMcpServer(getCaller(authInfo)), {
    onerror: (err) => logger.warn({ err }, 'MCP request error'),
  });

  const app = new Hono();

  app.all('/', async (c) => {
    const authorization = c.req.header('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return challenge();
    }

    let caller: McpCaller;
    try {
      caller = await authenticate(authorization);
    } catch (err) {
      if (err instanceof McpAuthError) {
        return challenge({ error: err.error, message: err.message });
      }
      if (err instanceof ApiError) {
        return challenge({ error: 'invalid_token', message: err.message });
      }
      throw err;
    }

    return handler.fetch(c.req.raw, { authInfo: toAuthInfo(caller) });
  });

  return app;
}
