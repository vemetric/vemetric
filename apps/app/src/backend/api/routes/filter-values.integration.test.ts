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

async function postFilterValues(
  body: unknown,
  headers: {
    Authorization: string;
    'Content-Type': 'application/json';
  },
) {
  const app = createPublicApi();

  return app.request('/v1/filters/values', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/filters/values (integration, seeded fixtures)', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;
  let isolated: IsolatedAnalyticsSeedContext;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-19T11:22:00.000Z'));

    isolated = createIsolatedAnalyticsSeedContext({
      projectId: '9000000000000005',
      keySeed: 5,
      projectName: 'Filter Values Integration Test Project',
      projectDomain: 'filter-values-integration-test.example.com',
    });
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

  it('returns values for requested fields', async () => {
    const response = await postFilterValues(
      {
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        fields: ['country', 'referrer', 'event:name'],
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      period: {
        from: '2026-01-18T00:00:00Z',
        to: '2026-01-19T23:59:59Z',
      },
      query: {
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        fields: ['country', 'referrer', 'event:name'],
        limit: 100,
        offset: 0,
      },
      data: [
        {
          field: 'country',
          pagination: { limit: 100, offset: 0, returned: 2 },
          values: ['DE', 'US'],
        },
        {
          field: 'referrer',
          pagination: { limit: 100, offset: 0, returned: 3 },
          values: ['Bing', 'Google', 'Newsletter'],
        },
        {
          field: 'event:name',
          pagination: { limit: 100, offset: 0, returned: 3 },
          values: ['click', 'purchase', 'signup'],
        },
      ],
    });
  });

  it('applies global pagination per field', async () => {
    const response = await postFilterValues(
      {
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        fields: ['country', 'event:name'],
        limit: 2,
        offset: 1,
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      query: {
        limit: 2,
        offset: 1,
      },
      data: [
        {
          field: 'country',
          pagination: { limit: 2, offset: 1, returned: 1 },
          values: ['US'],
        },
        {
          field: 'event:name',
          pagination: { limit: 2, offset: 1, returned: 2 },
          values: ['purchase', 'signup'],
        },
      ],
    });
  });
});
