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
          metrics: ['users', 'pageviews', 'events'],
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

    it.each([
      ['city', { Berlin: 1, 'New York': 1, 'San Francisco': 1, Unknown: 1 }],
      ['page:origin', { 'https://example.com': 4 }],
      ['page:path', { '/': 4, '/features': 1, '/pricing': 2, '/signup': 1 }],
      ['browser', { Chrome: 2, Firefox: 1, Safari: 1 }],
      ['device_type', { desktop: 2, mobile: 1, tablet: 1 }],
      ['os', { Linux: 1, Windows: 1, macOS: 2 }],
      ['referrer', { Bing: 1, Google: 1, Newsletter: 1, 'Direct / None': 1 }],
      ['referrer_type', { email: 1, search: 2, social: 1 }],
      ['utm_campaign', { jan_push: 2, winter_launch: 2 }],
      ['utm_content', { ad_1: 1, button: 1, hero_cta: 1, text_link: 1 }],
      ['utm_medium', { cpc: 2, email: 1, social: 1 }],
      ['utm_source', { bing: 1, google: 1, hn: 1, newsletter: 1 }],
      ['utm_term', { analytics: 1, metrics: 1, opensource: 1, privacy: 1 }],
      ['event:name', { click: 1, purchase: 1, signup: 2 }],
    ] as const)('supports grouping by %s', async (groupBy, expectedUsersByGroup) => {
      const response = await postAnalyticsQuery(
        {
          date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
          metrics: ['users'],
          group_by: [groupBy],
          order_by: [[groupBy, 'asc']],
          limit: 100,
          offset: 0,
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.query.group_by).toEqual([groupBy]);

      const actual = Object.fromEntries(
        body.data.map((row: { group: Record<string, string>; metrics: { users: number } }) => [
          row.group[groupBy],
          row.metrics.users,
        ]),
      );
      expect(actual).toEqual(expectedUsersByGroup);
    });

    it('supports grouping by event:name for events metric values', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
          metrics: ['events'],
          group_by: ['event:name'],
          order_by: [['event:name', 'asc']],
          limit: 100,
          offset: 0,
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: [
          { group: { 'event:name': 'click' }, metrics: { events: 1 } },
          { group: { 'event:name': 'purchase' }, metrics: { events: 1 } },
          { group: { 'event:name': 'signup' }, metrics: { events: 3 } },
        ],
      });
    });

    it('returns null for non-applicable metrics when grouped by event:name', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
          metrics: ['events', 'bounce_rate', 'visit_duration'],
          group_by: ['event:name'],
          order_by: [['event:name', 'asc']],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: Array<{ metrics: Record<string, number | null> }>;
      };
      expect(body.data.every((row) => row.metrics.bounce_rate === null && row.metrics.visit_duration === null)).toBe(
        true,
      );
    });

    it('never returns "__all__" as a grouped field value', async () => {
      const cityResponse = await postAnalyticsQuery(
        {
          date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
          metrics: ['users'],
          group_by: ['city'],
          order_by: [['city', 'asc']],
        },
        isolated.authHeaders,
      );
      expect(cityResponse.status).toBe(200);
      const cityBody = await cityResponse.json();
      expect(cityBody.data.every((row: { group: { city?: string } }) => row.group.city !== '__all__')).toBe(true);

      const referrerResponse = await postAnalyticsQuery(
        {
          date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
          metrics: ['users'],
          group_by: ['referrer'],
          order_by: [['referrer', 'asc']],
        },
        isolated.authHeaders,
      );
      expect(referrerResponse.status).toBe(200);
      const referrerBody = await referrerResponse.json();
      expect(referrerBody.data.every((row: { group: { referrer?: string } }) => row.group.referrer !== '__all__')).toBe(
        true,
      );
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
              operator: 'eq',
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
              operator: 'eq',
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
          filters: [
            {
              type: 'event',
              name: {
                operator: 'eq',
                value: 'signup',
              },
            },
          ],
          filters_operator: 'and',
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
                operator: 'eq',
                value: 'signup',
              },
              properties: [
                {
                  property: 'plan',
                  operator: 'eq',
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
                operator: 'eq',
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
                operator: 'eq',
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

    it('applies page filters directly to grouped users rows when mixed with pageviews', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['users', 'pageviews'],
          group_by: ['page:path'],
          order_by: [['page:path', 'asc']],
          filters: [
            {
              type: 'page',
              path: {
                operator: 'eq',
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
            group: { 'page:path': '/features' },
            metrics: { users: 1, pageviews: 1 },
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
                operator: 'eq',
                value: 'signup',
              },
              properties: [
                {
                  property: 'plan',
                  operator: 'eq',
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

    it('treats page filters as cohort filters for events rows (dashboard-compatible)', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['events'],
          group_by: ['event:name'],
          order_by: [['event:name', 'asc']],
          filters: [
            {
              type: 'page',
              path: {
                operator: 'eq',
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
            // User visited /features but the counted event rows happened on /signup.
            group: { 'event:name': 'signup' },
            metrics: { events: 2 },
          },
        ],
      });
    });

    it('keeps grouped page rows constrained to page filters when mixing events and pageviews', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['events', 'pageviews'],
          group_by: ['page:path'],
          order_by: [['pageviews', 'desc']],
          filters: [
            {
              type: 'page',
              path: {
                operator: 'eq',
                value: '/features',
              },
            },
          ],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: Array<{ group: Record<string, string>; metrics: Record<string, number | null> }>;
      };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        group: { 'page:path': '/features' },
        metrics: { pageviews: 1 },
      });
    });

    it('applies event filters directly to grouped users rows when mixed with events by event:name', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
          metrics: ['users', 'events'],
          group_by: ['event:name'],
          order_by: [['event:name', 'asc']],
          filters: [
            {
              type: 'event',
              name: {
                operator: 'eq',
                value: 'signup',
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
            group: { 'event:name': 'signup' },
            metrics: { users: 2, events: 3 },
          },
        ],
      });
    });

    it('applies event filters directly to grouped users rows when mixed with events by event property', async () => {
      const response = await postAnalyticsQuery(
        {
          date_range: '30days',
          metrics: ['users', 'events'],
          group_by: ['event:prop:plan'],
          order_by: [['event:prop:plan', 'asc']],
          filters: [
            {
              type: 'event',
              name: {
                operator: 'eq',
                value: 'signup',
              },
              properties: [
                {
                  property: 'plan',
                  operator: 'eq',
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
            metrics: { users: 1, events: 1 },
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
                operator: 'eq',
                value: 'signup',
              },
            },
          ],
        },
        isolated.authHeaders,
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: Array<{ group: Record<string, string>; metrics: Record<string, number | null> }>;
      };
      expect(body.data.some((row) => Object.values(row.group).includes('__all__'))).toBe(false);
      expect(body.data.every((row) => row.group['event:prop:plan'] !== '__all__')).toBe(true);
      expect(body.data.every((row) => row.metrics.bounce_rate === null && row.metrics.visit_duration === null)).toBe(
        true,
      );
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
                  operator: 'eq',
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
