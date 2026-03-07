import type { Mock } from 'vitest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicApi } from '../index';
import {
  createIsolatedAnalyticsSeedContext,
  resetAnalyticsFixtureData,
  seedAnalyticsFixtureData,
  type IsolatedAnalyticsSeedContext,
} from './analytics.integration.seeding';

const { findByKeyHashMock, findByIdMock, getRedisClientMock } = vi.hoisted(() => ({
  findByKeyHashMock: vi.fn(),
  findByIdMock: vi.fn(),
  getRedisClientMock: vi.fn(),
}));

vi.mock('database', () => ({
  dbApiKey: {
    findByKeyHash: findByKeyHashMock,
  },
  dbFunnel: {
    findById: findByIdMock,
  },
}));

vi.mock('../../utils/redis', () => ({
  getRedisClient: getRedisClientMock,
}));

async function postFunnelResults(
  id: string,
  body: unknown,
  headers: {
    Authorization: string;
    'Content-Type': 'application/json';
  },
) {
  const app = createPublicApi();

  return app.request(`/v1/funnels/${id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/funnels/:id (integration, seeded fixtures)', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const findById = findByIdMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;
  let isolated: IsolatedAnalyticsSeedContext;
  const funnelId = '550e8400-e29b-41d4-a716-446655440000';
  const funnelCreatedAt = new Date('2026-01-15T08:00:00.000Z');
  const funnelUpdatedAt = new Date('2026-01-16T09:30:00.000Z');

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-19T11:22:00.000Z'));

    isolated = createIsolatedAnalyticsSeedContext({
      projectId: '9000000000000003',
      keySeed: 3,
      projectName: 'Funnels Integration Test Project',
      projectDomain: 'funnels-integration-test.example.com',
    });
    await resetAnalyticsFixtureData(isolated);
    await seedAnalyticsFixtureData(isolated);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    findByKeyHash.mockReset();
    findById.mockReset();
    getRedisClient.mockReset();

    findByKeyHash.mockResolvedValue(isolated.apiKeyRecord);
    findById.mockResolvedValue({
      id: funnelId,
      projectId: isolated.projectId,
      name: 'Signup Funnel',
      icon: 'rocket',
      steps: [
        {
          id: 'step_1',
          name: '',
          filter: {
            type: 'page',
            pathFilter: {
              operator: 'is',
              value: '/',
            },
          },
        },
        {
          id: 'step_2',
          name: 'Signed Up',
          filter: {
            type: 'event',
            nameFilter: {
              operator: 'is',
              value: 'signup',
            },
          },
        },
      ],
      createdAt: funnelCreatedAt,
      updatedAt: funnelUpdatedAt,
    });
    getRedisClient.mockResolvedValue({
      eval: vi.fn().mockResolvedValue([1, 60]),
    });
  });

  it('returns exact funnel results for a custom date range', async () => {
    const response = await postFunnelResults(
      funnelId,
      {
        dateRange: ['2026-01-18', '2026-01-19'],
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
        dateRange: ['2026-01-18', '2026-01-19'],
      },
      funnel: {
        id: funnelId,
        name: 'Signup Funnel',
        icon: 'rocket',
        steps: [
          {
            id: 'step_1',
            name: 'Step 1',
            filter: {
              type: 'page',
              path: {
                operator: 'eq',
                value: '/',
              },
            },
          },
          {
            id: 'step_2',
            name: 'Signed Up',
            filter: {
              type: 'event',
              name: {
                operator: 'eq',
                value: 'signup',
              },
            },
          },
        ],
        createdAt: funnelCreatedAt.toISOString(),
        updatedAt: funnelUpdatedAt.toISOString(),
      },
      results: {
        activeUsers: 4,
        steps: [
          {
            id: 'step_1',
            name: 'Step 1',
            users: 4,
            conversionRate: 100,
          },
          {
            id: 'step_2',
            name: 'Signed Up',
            users: 2,
            conversionRate: 50,
          },
        ],
        conversionRate: 50,
        activeUserConversionRate: 50,
      },
    });
  });

  it('applies filters and returns filtered conversion values', async () => {
    const response = await postFunnelResults(
      funnelId,
      {
        dateRange: ['2026-01-18', '2026-01-19'],
        filters: [
          {
            type: 'location',
            country: {
              operator: 'oneOf',
              value: ['US'],
            },
          },
        ],
        filtersOperator: 'and',
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
        dateRange: ['2026-01-18', '2026-01-19'],
        filters: [
          {
            type: 'location',
            country: {
              operator: 'oneOf',
              value: ['US'],
            },
          },
        ],
        filtersOperator: 'and',
      },
      funnel: {
        id: funnelId,
        name: 'Signup Funnel',
        icon: 'rocket',
        steps: [
          {
            id: 'step_1',
            name: 'Step 1',
            filter: {
              type: 'page',
              path: {
                operator: 'eq',
                value: '/',
              },
            },
          },
          {
            id: 'step_2',
            name: 'Signed Up',
            filter: {
              type: 'event',
              name: {
                operator: 'eq',
                value: 'signup',
              },
            },
          },
        ],
        createdAt: funnelCreatedAt.toISOString(),
        updatedAt: funnelUpdatedAt.toISOString(),
      },
      results: {
        activeUsers: 3,
        steps: [
          {
            id: 'step_1',
            name: 'Step 1',
            users: 3,
            conversionRate: 100,
          },
          {
            id: 'step_2',
            name: 'Signed Up',
            users: 2,
            conversionRate: 66.67,
          },
        ],
        conversionRate: 66.67,
        activeUserConversionRate: 66.67,
      },
    });
  });

  it('returns different activeUserConversionRate and conversionRate when not all active users enter the funnel', async () => {
    const response = await postFunnelResults(
      funnelId,
      {
        dateRange: '30days',
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.results.activeUsers).toBe(5);
    expect(body.results.steps).toEqual([
      {
        id: 'step_1',
        name: 'Step 1',
        users: 4,
        conversionRate: 100,
      },
      {
        id: 'step_2',
        name: 'Signed Up',
        users: 2,
        conversionRate: 50,
      },
    ]);
    expect(body.results.conversionRate).toBe(50);
    expect(body.results.activeUserConversionRate).toBe(40);
    expect(body.results.activeUserConversionRate).not.toBe(body.results.conversionRate);
  });
});
