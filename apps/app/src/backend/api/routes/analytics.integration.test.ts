import type { Mock } from 'vitest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicApi } from '../index';
import {
  createIsolatedAnalyticsSeedContext,
  resetAnalyticsFixtureData,
  seedAnalyticsFixtureData,
  type IsolatedAnalyticsSeedContext,
} from './analytics.integration.seeding';

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

async function postAnalyticsQuery(
  body: unknown,
  headers: {
    Authorization: string;
    'Content-Type': 'application/json';
  },
) {
  const app = createPublicApi();

  return app.request('/v1/analytics/query', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Integration-oriented API tests (active/red for TDD).
 *
 * NOTE:
 * We currently mock auth key lookup + redis rate limiter to keep tests deterministic.
 * Once full local/CI infra seeding is wired (Postgres + ClickHouse + Redis),
 * these mocks can be removed and replaced with real seeded auth data.
 */
describe('POST /api/v1/analytics/query (integration, seeded fixtures)', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;
  let isolated: IsolatedAnalyticsSeedContext;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-17T23:59:59.000Z'));

    isolated = createIsolatedAnalyticsSeedContext();
    await resetAnalyticsFixtureData(isolated);
    await seedAnalyticsFixtureData(isolated);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    findByKeyHash.mockReset();
    getRedisClient.mockReset();

    findByKeyHash.mockResolvedValue(isolated.apiKeyRecord);
    getRedisClient.mockResolvedValue({
      eval: vi.fn().mockResolvedValue([1, 60]),
    });
  });

  describe('aggregate', () => {
    it('returns exact output for preset range', async () => {
      const request = {
        date_range: '30days',
        metrics: ['users', 'pageviews', 'events', 'bounce_rate', 'visit_duration'],
        group_by: [],
        order_by: [['users', 'desc']],
      };

      const expected = {
        period: {
          from: '2026-01-19T00:00:00Z',
          to: '2026-02-17T23:59:59Z',
        },
        query: {
          date_range: '30days',
          group_by: [],
          metrics: ['users', 'pageviews', 'events', 'bounce_rate', 'visit_duration'],
          order_by: [['users', 'desc']],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 1,
          offset: 0,
          returned: 1,
        },
        data: [
          {
            group: {},
            metrics: {
              users: 2,
              pageviews: 4,
              events: 3,
              bounce_rate: 50,
              visit_duration: 150,
            },
          },
        ],
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(expected);
    });

    it('returns exact output when metrics are omitted (defaults)', async () => {
      const request = {
        date_range: '30days',
        group_by: [],
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-01-19T00:00:00Z',
          to: '2026-02-17T23:59:59Z',
        },
        query: {
          date_range: '30days',
          group_by: [],
          metrics: ['users', 'pageviews', 'events', 'bounce_rate', 'visit_duration'],
          order_by: [],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 1,
          offset: 0,
          returned: 1,
        },
        data: [
          {
            group: {},
            metrics: {
              users: 2,
              pageviews: 4,
              events: 3,
              bounce_rate: 50,
              visit_duration: 150,
            },
          },
        ],
      });
    });

    it('ignores pagination params when group_by is empty', async () => {
      const request = {
        date_range: '30days',
        metrics: ['users'],
        group_by: [],
        limit: 1,
        offset: 50,
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-01-19T00:00:00Z',
          to: '2026-02-17T23:59:59Z',
        },
        query: {
          date_range: '30days',
          group_by: [],
          metrics: ['users'],
          order_by: [],
          limit: 1,
          offset: 50,
        },
        pagination: {
          limit: 1,
          offset: 0,
          returned: 1,
        },
        data: [
          {
            group: {},
            metrics: {
              users: 2,
            },
          },
        ],
      });
    });

    it('returns exact output for custom UTC datetime range', async () => {
      const request = {
        date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        metrics: ['users', 'events'],
        group_by: [],
        order_by: [],
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-01-18T00:00:00Z',
          to: '2026-01-19T23:59:59Z',
        },
        query: {
          date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
          group_by: [],
          metrics: ['users', 'events'],
          order_by: [],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 1,
          offset: 0,
          returned: 1,
        },
        data: [
          {
            group: {},
            metrics: {
              users: 4,
              events: 5,
            },
          },
        ],
      });
    });
  });

  describe('grouped', () => {
    it('returns exact timeseries output for interval:auto', async () => {
      const request = {
        date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        metrics: ['users', 'pageviews', 'events'],
        group_by: ['interval:auto'],
        order_by: [['date', 'asc']],
      };

      const expected = {
        period: {
          from: '2026-01-18T00:00:00Z',
          to: '2026-01-19T23:59:59Z',
        },
        query: {
          date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
          group_by: ['interval:auto'],
          metrics: ['users', 'pageviews', 'events'],
          order_by: [['date', 'asc']],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 100,
          offset: 0,
          returned: 2,
        },
        data: [
          {
            group: {
              date: '2026-01-18T00:00:00Z',
            },
            metrics: {
              users: 2,
              pageviews: 4,
              events: 2,
            },
          },
          {
            group: {
              date: '2026-01-19T00:00:00Z',
            },
            metrics: {
              users: 2,
              pageviews: 4,
              events: 3,
            },
          },
        ],
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(expected);
    });

    it('returns exact country breakdown sorted by group field', async () => {
      const request = {
        date_range: '30days',
        metrics: ['users', 'pageviews', 'events'],
        group_by: ['country'],
        order_by: [['country', 'asc']],
        limit: 100,
        offset: 0,
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-01-19T00:00:00Z',
          to: '2026-02-17T23:59:59Z',
        },
        query: {
          date_range: '30days',
          group_by: ['country'],
          metrics: ['users', 'pageviews', 'events'],
          order_by: [['country', 'asc']],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 100,
          offset: 0,
          returned: 2,
        },
        data: [
          {
            group: { country: 'DE' },
            metrics: { users: 1, pageviews: 1, events: 1 },
          },
          {
            group: { country: 'US' },
            metrics: { users: 1, pageviews: 3, events: 2 },
          },
        ],
      });
    });

    it('supports ordering by metric value', async () => {
      const request = {
        date_range: '30days',
        metrics: ['events'],
        group_by: ['country'],
        order_by: [['events', 'desc']],
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: [
          { group: { country: 'US' }, metrics: { events: 2 } },
          { group: { country: 'DE' }, metrics: { events: 1 } },
        ],
      });
    });

    it('supports ordering by event property field', async () => {
      const request = {
        date_range: '30days',
        metrics: ['events'],
        group_by: ['event:prop:plan'],
        order_by: [['event:prop:plan', 'asc']],
        filters: [
          {
            type: 'event',
            name: {
              operator: 'is',
              value: 'signup',
            },
          },
        ],
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: [
          { group: { 'event:prop:plan': 'pro' }, metrics: { events: 1 } },
          { group: { 'event:prop:plan': 'starter' }, metrics: { events: 1 } },
        ],
      });
    });

    it('supports pagination with limit and offset', async () => {
      const request = {
        date_range: '30days',
        metrics: ['users'],
        group_by: ['country'],
        order_by: [['country', 'asc']],
        limit: 1,
        offset: 1,
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-01-19T00:00:00Z',
          to: '2026-02-17T23:59:59Z',
        },
        query: {
          date_range: '30days',
          group_by: ['country'],
          metrics: ['users'],
          order_by: [['country', 'asc']],
          limit: 1,
          offset: 1,
        },
        pagination: {
          limit: 1,
          offset: 1,
          returned: 1,
        },
        data: [
          {
            group: { country: 'US' },
            metrics: { users: 1 },
          },
        ],
      });
    });

    it('returns exact event property breakdown scoped via filters', async () => {
      const request = {
        date_range: '30days',
        metrics: ['events'],
        group_by: ['event:prop:plan'],
        order_by: [['events', 'desc']],
        filters: [
          {
            type: 'event',
            name: {
              operator: 'is',
              value: 'signup',
            },
          },
        ],
      };

      const response = await postAnalyticsQuery(request, isolated.authHeaders);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-01-19T00:00:00Z',
          to: '2026-02-17T23:59:59Z',
        },
        query: {
          date_range: '30days',
          group_by: ['event:prop:plan'],
          metrics: ['events'],
          order_by: [['events', 'desc']],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 100,
          offset: 0,
          returned: 2,
        },
        data: [
          {
            group: { 'event:prop:plan': 'pro' },
            metrics: { events: 1 },
          },
          {
            group: { 'event:prop:plan': 'starter' },
            metrics: { events: 1 },
          },
        ],
      });
    });

    it('applies event filters directly to event metric rows', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['events'],
          group_by: ['event:prop:plan'],
          order_by: [['events', 'desc']],
          filters: [
            {
              type: 'event',
              name: {
                operator: 'is',
                value: 'signup',
              },
              properties: [
                {
                  property: 'plan',
                  operator: 'is',
                  value: 'pro',
                },
              ],
            },
          ],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: [
          {
            group: { 'event:prop:plan': 'pro' },
            metrics: { events: 1 },
          },
        ],
      });
    });

    it('applies page filters directly to pageviews metric rows', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['pageviews'],
          group_by: [],
          filters: [
            {
              type: 'page',
              path: {
                operator: 'is',
                value: '/features',
              },
            },
          ],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: [
          {
            group: {},
            metrics: { pageviews: 1 },
          },
        ],
      });
    });

    it('applies page filters directly to grouped pageviews rows', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['pageviews'],
          group_by: ['country'],
          order_by: [['country', 'asc']],
          filters: [
            {
              type: 'page',
              path: {
                operator: 'is',
                value: '/features',
              },
            },
          ],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: [
          {
            group: { country: 'US' },
            metrics: { pageviews: 1 },
          },
        ],
      });
    });

    it('applies event filters directly to grouped event rows', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['events'],
          group_by: ['country'],
          order_by: [['country', 'asc']],
          filters: [
            {
              type: 'event',
              name: {
                operator: 'is',
                value: 'signup',
              },
              properties: [
                {
                  property: 'plan',
                  operator: 'is',
                  value: 'pro',
                },
              ],
            },
          ],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: [
          {
            group: { country: 'US' },
            metrics: { events: 1 },
          },
        ],
      });
    });

    it('does not expose __all__ placeholder for event property grouping', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['users', 'pageviews', 'events', 'bounce_rate', 'visit_duration'],
          group_by: ['event:prop:plan'],
          order_by: [['events', 'desc']],
          filters: [
            {
              type: 'event',
              name: {
                operator: 'is',
                value: 'signup',
              },
            },
          ],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: Array<{ group: Record<string, string>; metrics: Record<string, number> }>;
      };
      expect(body.data.some((row) => Object.values(row.group).includes('__all__'))).toBe(false);
      expect(body.data.every((row) => row.group['event:prop:plan'] !== '__all__')).toBe(true);
      expect(body.data.every((row) => row.metrics.bounce_rate === 0 && row.metrics.visit_duration === 0)).toBe(true);
    });

    it('returns only requested metrics in metrics object', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['users'],
          group_by: ['country'],
          order_by: [['country', 'asc']],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-01-19T00:00:00Z',
          to: '2026-02-17T23:59:59Z',
        },
        query: {
          date_range: '30days',
          group_by: ['country'],
          metrics: ['users'],
          order_by: [['country', 'asc']],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 100,
          offset: 0,
          returned: 2,
        },
        data: [
          {
            group: { country: 'DE' },
            metrics: { users: 1 },
          },
          {
            group: { country: 'US' },
            metrics: { users: 1 },
          },
        ],
      });
    });
  });

  describe('empty_result', () => {
    it('returns exact period for custom UTC datetime range with time components', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: ['2026-02-10T06:30:00Z', '2026-02-11T08:45:00Z'],
          metrics: ['users'],
          group_by: ['country'],
          order_by: [['country', 'asc']],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-02-10T06:30:00Z',
          to: '2026-02-11T08:45:00Z',
        },
        query: {
          date_range: ['2026-02-10T06:30:00Z', '2026-02-11T08:45:00Z'],
          group_by: ['country'],
          metrics: ['users'],
          order_by: [['country', 'asc']],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 100,
          offset: 0,
          returned: 0,
        },
        data: [],
      });
    });

    it('returns empty grouped result when date range has no matching data', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: ['2026-02-10', '2026-02-11'],
          metrics: ['users'],
          group_by: ['country'],
          order_by: [['country', 'asc']],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-02-10T00:00:00Z',
          to: '2026-02-11T23:59:59Z',
        },
        query: {
          date_range: ['2026-02-10', '2026-02-11'],
          group_by: ['country'],
          metrics: ['users'],
          order_by: [['country', 'asc']],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 100,
          offset: 0,
          returned: 0,
        },
        data: [],
      });
    });

    it('returns zeroed aggregate row when date range has no matching data', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: ['2026-02-10', '2026-02-11'],
          metrics: ['users', 'events'],
          group_by: [],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        period: {
          from: '2026-02-10T00:00:00Z',
          to: '2026-02-11T23:59:59Z',
        },
        query: {
          date_range: ['2026-02-10', '2026-02-11'],
          group_by: [],
          metrics: ['users', 'events'],
          order_by: [],
          limit: 100,
          offset: 0,
        },
        pagination: {
          limit: 1,
          offset: 0,
          returned: 1,
        },
        data: [
          {
            group: {},
            metrics: {
              users: 0,
              events: 0,
            },
          },
        ],
      });
    });
  });

  describe('validation', () => {
    it('allows event property grouping when event filter is missing', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['events'],
          group_by: ['event:prop:plan'],
          order_by: [['events', 'desc']],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('allows event property grouping when event filter has no nameFilter', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['events'],
          group_by: ['event:prop:plan'],
          filters: [
            {
              type: 'event',
              properties: [
                {
                  property: 'plan',
                  operator: 'is',
                  value: 'pro',
                },
              ],
            },
          ],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('rejects reversed custom date_range array', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: ['2026-02-17', '2026-01-18'],
          metrics: ['users'],
          group_by: [],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('rejects invalid order_by direction', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['users'],
          group_by: ['country'],
          order_by: [['country', 'down']],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });
  });
});
