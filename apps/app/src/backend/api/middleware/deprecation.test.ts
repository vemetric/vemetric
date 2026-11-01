import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { describe, expect, it } from 'vitest';
import { deprecateRoute } from './deprecation';
import type { PublicApiHonoEnv } from '../types';
import { ApiError, errorHandler } from '../utils/errors';

const deprecatedAt = new Date('2026-01-01T00:00:00Z');
const sunsetAt = new Date('2026-07-01T00:00:00Z');

function createTestApp() {
  const app = new OpenAPIHono<PublicApiHonoEnv>();
  app.onError(errorHandler);

  const route = createRoute({
    method: 'get',
    path: '/v1/old',
    operationId: 'getOld',
    ...deprecateRoute({ deprecatedAt, sunsetAt, link: 'https://vemetric.com/docs/api/migration' }),
    request: { query: z.object({ fail: z.string().optional() }) },
    responses: {
      200: { description: 'Success', content: { 'application/json': { schema: z.object({ status: z.string() }) } } },
    },
  });
  app.openapi(route, (c) => {
    if (c.req.valid('query').fail) {
      throw new ApiError(404, 'NOT_FOUND', 'Not found');
    }
    return c.json({ status: 'ok' }, 200);
  });
  app.get('/v1/current', (c) => c.json({ status: 'ok' }));
  app.doc('/openapi.json', { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } });

  return app;
}

describe('deprecateRoute', () => {
  it('sends Deprecation, Sunset and Link headers', async () => {
    const response = await createTestApp().request('/v1/old');

    expect(response.status).toBe(200);
    expect(response.headers.get('Deprecation')).toBe('@1767225600');
    expect(response.headers.get('Sunset')).toBe('Wed, 01 Jul 2026 00:00:00 GMT');
    expect(response.headers.get('Link')).toBe(
      '<https://vemetric.com/docs/api/migration>; rel="deprecation"; type="text/html"',
    );
  });

  it('keeps the headers on error responses', async () => {
    const response = await createTestApp().request('/v1/old?fail=1');

    expect(response.status).toBe(404);
    expect(response.headers.get('Deprecation')).toBe('@1767225600');
    expect(response.headers.get('Sunset')).toBe('Wed, 01 Jul 2026 00:00:00 GMT');
  });

  it('does not affect other routes', async () => {
    const response = await createTestApp().request('/v1/current');

    expect(response.headers.get('Deprecation')).toBeNull();
    expect(response.headers.get('Sunset')).toBeNull();
    expect(response.headers.get('Link')).toBeNull();
  });

  it('marks the operation as deprecated in the OpenAPI spec', async () => {
    const spec = await (await createTestApp().request('/openapi.json')).json();

    expect(spec.paths['/v1/old'].get.deprecated).toBe(true);
  });
});
