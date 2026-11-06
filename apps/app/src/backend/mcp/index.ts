import { createMcpHandler } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { getCaller, toAuthInfo } from './caller';
import { createVemetricMcpServer } from './server';
import { authenticateApiKey } from '../api/middleware/auth';
import { logger } from '../api/utils/api-logger';
import { ApiError } from '../api/utils/errors';

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
    let caller;
    try {
      caller = await authenticateApiKey(c.req.header('Authorization'));
    } catch (err) {
      if (!(err instanceof ApiError)) {
        throw err;
      }
      return c.json({ error: { code: err.code, message: err.message } }, 401, {
        'WWW-Authenticate': `Bearer error="invalid_token", error_description="${err.message}"`,
      });
    }

    return handler.fetch(c.req.raw, { authInfo: toAuthInfo(caller) });
  });

  return app;
}
