import { describe, expect, it, vi } from 'vitest';
import { createPublicApi } from './index';
import { API_ERROR_CODES } from './utils/errors';

vi.mock('database', () => ({
  dbApiKey: {
    findByKeyHash: vi.fn(),
  },
}));

vi.mock('../utils/redis', () => ({
  getRedisClient: vi.fn(),
}));

type Operation = {
  operationId?: string;
  tags?: string[];
  parameters?: { name: string; in: string }[];
  responses: Record<string, { $ref?: string; headers?: Record<string, unknown> }>;
};

async function getSpec() {
  const response = await createPublicApi().request('/openapi.json');
  expect(response.status).toBe(200);
  return response.json();
}

function getOperations(spec: { paths: Record<string, Record<string, Operation>> }) {
  return Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({ path, method, operation })),
  );
}

function collectRefs(value: unknown, refs: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, refs));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === '$ref' && typeof item === 'string') {
        refs.push(item);
      } else {
        collectRefs(item, refs);
      }
    }
  }
  return refs;
}

describe('public API OpenAPI spec', () => {
  it('gives every operation a unique operationId and tags', async () => {
    const operations = getOperations(await getSpec());

    expect(
      Object.fromEntries(operations.map(({ path, method, operation }) => [`${method} ${path}`, operation.operationId])),
    ).toEqual({
      'get /v1/project': 'getProject',
      'post /v1/analytics/query': 'queryAnalytics',
      'post /v1/filters/values': 'getFilterValues',
      'post /v1/users': 'listUsers',
      'get /v1/users/single': 'getUser',
      'post /v1/users/events': 'listUserEvents',
      'get /v1/funnels': 'listFunnels',
      'post /v1/funnels/{id}': 'getFunnelResults',
    });
    for (const { operation } of operations) {
      expect(operation.tags?.length).toBeGreaterThan(0);
    }
  });

  it('documents auth as a bearer security scheme instead of a header parameter', async () => {
    const spec = await getSpec();

    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.servers).toEqual([{ url: 'https://api.vemetric.com' }]);
    for (const { operation } of getOperations(spec)) {
      expect(
        operation.parameters?.some((param) => param.in === 'header' && param.name.toLowerCase() === 'authorization'),
      ).not.toBe(true);
    }
  });

  it('points every error response at a shared typed error response', async () => {
    const spec = await getSpec();

    expect(spec.components.schemas.Error.properties.code.enum).toEqual([...API_ERROR_CODES]);
    expect(spec.components.schemas.Error.required).toEqual(['code', 'message']);
    for (const { operation } of getOperations(spec)) {
      for (const [status, response] of Object.entries(operation.responses)) {
        if (Number(status) >= 400) {
          expect(response.$ref).toMatch(/^#\/components\/responses\//);
        }
      }
    }
  });

  it('documents rate limit headers on success and 429 responses', async () => {
    const spec = await getSpec();

    expect(Object.keys(spec.components.responses.RateLimited.headers)).toEqual([
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
    ]);
    for (const { operation } of getOperations(spec)) {
      expect(Object.keys(operation.responses['200'].headers ?? {})).toEqual([
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset',
      ]);
    }
  });

  it('only uses $refs that resolve within #/components', async () => {
    const spec = await getSpec();

    for (const ref of collectRefs(spec)) {
      expect(ref).toMatch(/^#\/components\//);
      const target = ref
        .slice(2)
        .split('/')
        .reduce((node, key) => node?.[key], spec);
      expect(target, ref).toBeDefined();
    }
  });
});
