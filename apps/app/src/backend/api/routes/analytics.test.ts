import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicApi } from '../index';

const { findByKeyHashMock, getRedisClientMock } = vi.hoisted(() => ({
  findByKeyHashMock: vi.fn(),
  getRedisClientMock: vi.fn(),
}));

vi.mock('database', () => ({
  dbApiKey: {
    findByKeyHash: findByKeyHashMock,
  },
}));

vi.mock('../../utils/redis', () => ({
  getRedisClient: getRedisClientMock,
}));

const AUTH_HEADERS = {
  Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
  'Content-Type': 'application/json',
};

function expectValidationDetail(
  body: {
    error: {
      details: Array<{ field: string; message: string }>;
    };
  },
  field: string,
  message: string,
) {
  expect(body.error.details).toEqual(
    expect.arrayContaining([
      {
        field,
        message,
      },
    ]),
  );
}

function createMockApiKey() {
  return {
    id: 'key_1',
    projectId: '123',
    project: {
      id: '123',
      name: 'Demo Project',
      domain: 'demo.example.com',
      token: 'project_token_123',
      createdAt: new Date('2026-02-07T12:00:00.000Z'),
      firstEventAt: new Date('2026-02-07T12:30:00.000Z'),
      publicDashboard: false,
      excludedIps: null,
      excludedCountries: null,
    },
  };
}

describe('POST /api/v1/analytics/query (contract)', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;

  beforeEach(() => {
    findByKeyHash.mockReset();
    getRedisClient.mockReset();

    findByKeyHash.mockResolvedValue(createMockApiKey());
    getRedisClient.mockResolvedValue({
      eval: vi.fn().mockResolvedValue([1, 60]),
    });
  });

  describe('validation', () => {
    it('rejects invalid groupBy token', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: '30days',
          metrics: ['users'],
          groupBy: ['invalid:group'],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expect(Array.isArray(body.error.details)).toBe(true);
      expectValidationDetail(body, 'groupBy.0', 'Invalid grouping token');
    });

    it('rejects groupBy with more than one item', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: '30days',
          metrics: ['users'],
          groupBy: ['country', 'browser'],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expect(Array.isArray(body.error.details)).toBe(true);
      expectValidationDetail(body, 'groupBy', 'groupBy can include max one item');
    });

    it('rejects custom dateRange when start is after end', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: ['2026-02-18', '2026-02-17'],
          metrics: ['users'],
          groupBy: [],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expect(Array.isArray(body.error.details)).toBe(true);
      expectValidationDetail(body, 'dateRange', 'Start date must be before or equal to end date');
    });

    it('rejects non-UTC date input', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: ['2026-01-18T00:00:00+02:00', '2026-02-17T23:59:59+02:00'],
          metrics: ['users'],
          groupBy: [],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expect(Array.isArray(body.error.details)).toBe(true);
      expectValidationDetail(
        body,
        'dateRange.0',
        'UTC date input must be either YYYY-MM-DD or UTC ISO-8601 with second precision',
      );
    });

    it('rejects datetime input with milliseconds', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: ['2026-01-18T00:00:00.123Z', '2026-02-17T23:59:59Z'],
          metrics: ['users'],
          groupBy: [],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expect(Array.isArray(body.error.details)).toBe(true);
      expectValidationDetail(
        body,
        'dateRange.0',
        'UTC date input must be either YYYY-MM-DD or UTC ISO-8601 with second precision',
      );
    });

    it('rejects orderBy metric that is not requested in metrics', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: '30days',
          metrics: ['users'],
          groupBy: ['country'],
          orderBy: [['events', 'desc']],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expect(Array.isArray(body.error.details)).toBe(true);
      expectValidationDetail(body, 'orderBy.0.0', 'Sort metric must be included in metrics');
    });

    it('rejects invalid orderBy direction', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: '30days',
          metrics: ['users'],
          groupBy: ['country'],
          orderBy: [['country', 'down']],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expect(Array.isArray(body.error.details)).toBe(true);
      expectValidationDetail(body, 'orderBy.0.1', "Invalid enum value. Expected 'asc' | 'desc', received 'down'");
    });

    it('rejects legacy string filter operator "is" (use "eq")', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: '30days',
          metrics: ['users'],
          groupBy: [],
          filters: [
            {
              type: 'referrer',
              operator: 'is',
              value: 'Google',
            },
          ],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expect(Array.isArray(body.error.details)).toBe(true);
      expectValidationDetail(
        body,
        'filters.0.operator',
        "Invalid enum value. Expected 'any' | 'eq' | 'notEq' | 'contains' | 'notContains' | 'startsWith' | 'endsWith', received 'is'",
      );
    });

    it('rejects invalid event property groupBy token format', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: '30days',
          metrics: ['events'],
          groupBy: ['event:prop:'],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expectValidationDetail(body, 'groupBy.0', 'Invalid grouping token');
    });

    it('accepts event property groupBy token with dash and dollar', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: '30days',
          metrics: ['users'],
          groupBy: ['event:prop:plan-name$'],
          orderBy: [['events', 'desc']],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expectValidationDetail(body, 'orderBy.0.0', 'Sort metric must be included in metrics');
    });

    it('accepts new predefined grouping tokens', async () => {
      const app = createPublicApi();
      const groupingTokens = [
        'city',
        'page:origin',
        'page:path',
        'browser',
        'deviceType',
        'os',
        'referrer',
        'referrerType',
        'utmCampaign',
        'utmContent',
        'utmMedium',
        'utmSource',
        'utmTerm',
        'event:name',
      ];

      for (const token of groupingTokens) {
        const response = await app.request('/v1/analytics/query', {
          method: 'POST',
          headers: AUTH_HEADERS,
          body: JSON.stringify({
            dateRange: '30days',
            metrics: ['users'],
            groupBy: [token],
            orderBy: [['events', 'desc']],
          }),
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expectValidationDetail(body, 'orderBy.0.0', 'Sort metric must be included in metrics');
      }
    });

    it('rejects invalid sort field for active grouping', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: '30days',
          metrics: ['users'],
          groupBy: ['country'],
          orderBy: [['date', 'asc']],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
      expectValidationDetail(body, 'orderBy.0.0', 'Invalid sort field');
    });
  });

  describe('plan_limit', () => {
    it('rejects disallowed preset dateRange (6months)', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/analytics/query', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          dateRange: '6months',
          metrics: ['users'],
          groupBy: [],
        }),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'PLAN_LIMIT_EXCEEDED',
        },
      });
    });

    it('rejects all other restricted presets', async () => {
      const app = createPublicApi();

      for (const dateRange of ['3months', '1year'] as const) {
        const response = await app.request('/v1/analytics/query', {
          method: 'POST',
          headers: AUTH_HEADERS,
          body: JSON.stringify({
            dateRange: dateRange,
            metrics: ['users'],
            groupBy: [],
          }),
        });

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
          error: {
            code: 'PLAN_LIMIT_EXCEEDED',
          },
        });
      }
    });
  });
});
