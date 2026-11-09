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

describe('POST /api/v1/events/properties (integration, seeded fixtures)', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;
  let isolated: IsolatedAnalyticsSeedContext;

  async function postEventProperties(body: unknown) {
    return createPublicApi().request('/v1/events/properties', {
      method: 'POST',
      headers: isolated.authHeaders,
      body: JSON.stringify(body),
    });
  }

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-19T11:22:00.000Z'));

    isolated = createIsolatedAnalyticsSeedContext({
      projectId: '9000000000000007',
      keySeed: 7,
      projectName: 'Event Properties Integration Test Project',
      projectDomain: 'event-properties-integration-test.example.com',
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

  it('returns the properties of each event with event and user counts', async () => {
    const response = await postEventProperties({
      eventNames: ['signup', 'click'],
      dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      period: {
        from: '2026-01-18T00:00:00Z',
        to: '2026-01-19T23:59:59Z',
      },
      query: {
        eventNames: ['signup', 'click'],
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        limit: 100,
        offset: 0,
      },
      data: [
        {
          eventName: 'signup',
          pagination: { limit: 100, offset: 0, returned: 1 },
          properties: [{ name: 'plan', events: 3, users: 2 }],
        },
        {
          eventName: 'click',
          pagination: { limit: 100, offset: 0, returned: 0 },
          properties: [],
        },
      ],
    });
  });

  it('only counts events in the date range', async () => {
    const response = await postEventProperties({
      eventNames: ['signup'],
      dateRange: ['2026-01-19', '2026-01-19'],
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].properties).toEqual([{ name: 'plan', events: 2, users: 1 }]);
  });
});
