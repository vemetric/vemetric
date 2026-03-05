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

async function postUsersQuery(
  body: unknown,
  headers: {
    Authorization: string;
    'Content-Type': 'application/json';
  },
) {
  const app = createPublicApi();

  return app.request('/v1/users', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/users (integration, seeded fixtures)', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;
  let isolated: IsolatedAnalyticsSeedContext;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-19T11:22:00.000Z'));

    isolated = createIsolatedAnalyticsSeedContext({
      projectId: '9000000000000002',
      keySeed: 2,
      projectName: 'Users Integration Test Project',
      projectDomain: 'users-integration-test.example.com',
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

  it('returns compact user rows with explicit date_range and default sorting', async () => {
    const response = await postUsersQuery(
      {
        date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      period: {
        from: '2026-01-18T00:00:00Z',
        to: '2026-01-19T23:59:59Z',
      },
      pagination: {
        limit: 100,
        offset: 0,
        returned: 4,
      },
      users: [
        {
          id: '4',
          identifier: 'user-4',
          display_name: 'Charlie',
          country_code: 'DE',
          last_seen_at: '2026-01-19T11:20:00Z',
          last_event_fired_at: null,
          avatar_url: null,
          anonymous: false,
        },
        {
          id: '3',
          identifier: 'user-3',
          display_name: 'Bravo',
          country_code: 'US',
          last_seen_at: '2026-01-19T09:15:00Z',
          last_event_fired_at: null,
          avatar_url: null,
          anonymous: false,
        },
        {
          id: '2',
          identifier: 'user-2',
          display_name: 'Echo',
          country_code: 'US',
          last_seen_at: '2026-01-18T10:06:00Z',
          last_event_fired_at: null,
          avatar_url: null,
          anonymous: false,
        },
        {
          id: '1',
          identifier: 'user-1',
          display_name: 'Zulu',
          country_code: 'US',
          last_seen_at: '2026-01-18T09:02:00Z',
          last_event_fired_at: null,
          avatar_url: null,
          anonymous: false,
        },
      ],
    });
  });

  it('supports sorting by display_name', async () => {
    const response = await postUsersQuery(
      {
        date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        order_by: [['display_name', 'asc']],
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users.map((user: { display_name: string | null }) => user.display_name)).toEqual([
      'Bravo',
      'Charlie',
      'Echo',
      'Zulu',
    ]);
    expect(body.users.map((user: { id: string }) => user.id)).toEqual(['3', '4', '2', '1']);
    expect(body.users.every((user: { last_event_fired_at: string | null }) => user.last_event_fired_at === null)).toBe(
      true,
    );
  });

  it('supports sorting by last time a user fired a specific event', async () => {
    const response = await postUsersQuery(
      {
        date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        order_by: [
          [
            'last_event_fired',
            'desc',
            {
              name: {
                operator: 'eq',
                value: 'signup',
              },
            },
          ],
        ],
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users.map((user: { id: string }) => user.id).slice(0, 2)).toEqual(['3', '1']);
    expect(
      body.users.map((user: { id: string; last_seen_at: string | null; last_event_fired_at: string | null }) => ({
        id: user.id,
        last_seen_at: user.last_seen_at,
        last_event_fired_at: user.last_event_fired_at,
      })),
    ).toEqual([
      {
        id: '3',
        last_seen_at: '2026-01-19T09:15:00Z',
        last_event_fired_at: '2026-01-19T09:15:00Z',
      },
      {
        id: '1',
        last_seen_at: '2026-01-18T09:02:00Z',
        last_event_fired_at: '2026-01-18T09:02:00Z',
      },
      {
        id: '2',
        last_seen_at: '2026-01-18T10:06:00Z',
        last_event_fired_at: null,
      },
      {
        id: '4',
        last_seen_at: '2026-01-19T11:20:00Z',
        last_event_fired_at: null,
      },
    ]);
  });

  it('supports sorting by last time a user fired a specific event with properties', async () => {
    const response = await postUsersQuery(
      {
        date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        order_by: [
          [
            'last_event_fired',
            'desc',
            {
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
        ],
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(
      body.users.map((user: { id: string; last_event_fired_at: string | null }) => ({
        id: user.id,
        last_event_fired_at: user.last_event_fired_at,
      })),
    ).toEqual([
      { id: '3', last_event_fired_at: '2026-01-19T09:15:00Z' },
      { id: '1', last_event_fired_at: '2026-01-18T09:02:00Z' },
      { id: '2', last_event_fired_at: null },
      { id: '4', last_event_fired_at: null },
    ]);
  });

  it('scopes last_event_fired sorting and timestamp to the requested date_range', async () => {
    const response = await postUsersQuery(
      {
        date_range: ['2026-01-19T00:00:00Z', '2026-01-19T23:59:59Z'],
        order_by: [
          [
            'last_event_fired',
            'desc',
            {
              name: {
                operator: 'eq',
                value: 'signup',
              },
            },
          ],
        ],
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(
      body.users.map((user: { id: string; last_event_fired_at: string | null }) => ({
        id: user.id,
        last_event_fired_at: user.last_event_fired_at,
      })),
    ).toEqual([
      { id: '3', last_event_fired_at: '2026-01-19T09:15:00Z' },
      { id: '4', last_event_fired_at: null },
    ]);
  });

  it('supports limit and offset pagination', async () => {
    const response = await postUsersQuery(
      {
        date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        limit: 2,
        offset: 1,
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      pagination: {
        limit: 2,
        offset: 1,
        returned: 2,
      },
      users: [{ id: '3' }, { id: '2' }],
    });
  });

  it('applies event filters to the user list', async () => {
    const response = await postUsersQuery(
      {
        date_range: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
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
      pagination: {
        returned: 2,
      },
      users: [{ id: '3' }, { id: '1' }],
    });
  });

  it('defaults to 30days when date_range is omitted and returns the resolved period', async () => {
    const response = await postUsersQuery({}, isolated.authHeaders);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      period: {
        from: '2025-12-21T00:00:00Z',
        to: '2026-01-19T11:22:00Z',
      },
      pagination: {
        limit: 100,
        offset: 0,
        returned: 5,
      },
    });
  });

  it('returns anonymous users with normalized fields when included in the period', async () => {
    const response = await postUsersQuery({}, isolated.authHeaders);

    expect(response.status).toBe(200);
    const body = await response.json();
    const anonymousUser = body.users.find((user: { id: string }) => user.id === '5');

    expect(anonymousUser).toEqual({
      id: '5',
      identifier: null,
      display_name: null,
      country_code: null,
      last_seen_at: '2025-12-25T08:01:00Z',
      last_event_fired_at: null,
      avatar_url: null,
      anonymous: true,
    });
  });

  it('supports filtering anonymous users via user filter', async () => {
    const response = await postUsersQuery(
      {
        filters: [{ type: 'user', anonymous: true }],
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      pagination: {
        returned: 1,
      },
      users: [
        {
          id: '5',
          anonymous: true,
          identifier: null,
          display_name: null,
          last_event_fired_at: null,
        },
      ],
    });
  });
});
