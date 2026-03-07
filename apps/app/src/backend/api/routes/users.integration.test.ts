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

async function getSingleUser(
  query: Record<string, string>,
  headers: {
    Authorization: string;
    'Content-Type': 'application/json';
  },
) {
  const app = createPublicApi();
  const search = new URLSearchParams(query);

  return app.request(`/v1/users/single?${search.toString()}`, {
    method: 'GET',
    headers,
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

  it('returns compact user rows with explicit dateRange and default sorting', async () => {
    const response = await postUsersQuery(
      {
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
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
          displayName: 'Charlie',
          country: 'DE',
          city: 'Berlin',
          lastSeenAt: '2026-01-19T11:20:00Z',
          lastEventFiredAt: null,
          avatarUrl: null,
          anonymous: false,
        },
        {
          id: '3',
          identifier: 'user-3',
          displayName: 'Bravo',
          country: 'US',
          city: 'San Francisco',
          lastSeenAt: '2026-01-19T09:15:00Z',
          lastEventFiredAt: null,
          avatarUrl: null,
          anonymous: false,
        },
        {
          id: '2',
          identifier: 'user-2',
          displayName: 'Echo',
          country: 'US',
          city: null,
          lastSeenAt: '2026-01-18T10:06:00Z',
          lastEventFiredAt: null,
          avatarUrl: null,
          anonymous: false,
        },
        {
          id: '1',
          identifier: 'user-1',
          displayName: 'Zulu',
          country: 'US',
          city: 'New York',
          lastSeenAt: '2026-01-18T09:02:00Z',
          lastEventFiredAt: null,
          avatarUrl: null,
          anonymous: false,
        },
      ],
    });
  });

  it('supports sorting by displayName', async () => {
    const response = await postUsersQuery(
      {
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        orderBy: [['displayName', 'asc']],
      },
      isolated.authHeaders,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users.map((user: { displayName: string | null }) => user.displayName)).toEqual([
      'Bravo',
      'Charlie',
      'Echo',
      'Zulu',
    ]);
    expect(body.users.map((user: { id: string }) => user.id)).toEqual(['3', '4', '2', '1']);
    expect(body.users.every((user: { lastEventFiredAt: string | null }) => user.lastEventFiredAt === null)).toBe(
      true,
    );
  });

  it('supports sorting by last time a user fired a specific event', async () => {
    const response = await postUsersQuery(
      {
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        orderBy: [
          [
            'lastEventFired',
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
      body.users.map((user: { id: string; lastSeenAt: string | null; lastEventFiredAt: string | null }) => ({
        id: user.id,
        lastSeenAt: user.lastSeenAt,
        lastEventFiredAt: user.lastEventFiredAt,
      })),
    ).toEqual([
      {
        id: '3',
        lastSeenAt: '2026-01-19T09:15:00Z',
        lastEventFiredAt: '2026-01-19T09:15:00Z',
      },
      {
        id: '1',
        lastSeenAt: '2026-01-18T09:02:00Z',
        lastEventFiredAt: '2026-01-18T09:02:00Z',
      },
      {
        id: '2',
        lastSeenAt: '2026-01-18T10:06:00Z',
        lastEventFiredAt: null,
      },
      {
        id: '4',
        lastSeenAt: '2026-01-19T11:20:00Z',
        lastEventFiredAt: null,
      },
    ]);
  });

  it('supports sorting by last time a user fired a specific event with properties', async () => {
    const response = await postUsersQuery(
      {
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
        orderBy: [
          [
            'lastEventFired',
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
      body.users.map((user: { id: string; lastEventFiredAt: string | null }) => ({
        id: user.id,
        lastEventFiredAt: user.lastEventFiredAt,
      })),
    ).toEqual([
      { id: '3', lastEventFiredAt: '2026-01-19T09:15:00Z' },
      { id: '1', lastEventFiredAt: '2026-01-18T09:02:00Z' },
      { id: '2', lastEventFiredAt: null },
      { id: '4', lastEventFiredAt: null },
    ]);
  });

  it('scopes lastEventFired sorting and timestamp to the requested dateRange', async () => {
    const response = await postUsersQuery(
      {
        dateRange: ['2026-01-19T00:00:00Z', '2026-01-19T23:59:59Z'],
        orderBy: [
          [
            'lastEventFired',
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
      body.users.map((user: { id: string; lastEventFiredAt: string | null }) => ({
        id: user.id,
        lastEventFiredAt: user.lastEventFiredAt,
      })),
    ).toEqual([
      { id: '3', lastEventFiredAt: '2026-01-19T09:15:00Z' },
      { id: '4', lastEventFiredAt: null },
    ]);
  });

  it('supports limit and offset pagination', async () => {
    const response = await postUsersQuery(
      {
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
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
        dateRange: ['2026-01-18T00:00:00Z', '2026-01-19T23:59:59Z'],
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

  it('returns VALIDATION_ERROR when dateRange is omitted', async () => {
    const response = await postUsersQuery({}, isolated.authHeaders);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: [
          {
            field: 'dateRange',
            message: 'Invalid input',
          },
        ],
      },
    });
  });

  it('returns anonymous users with normalized fields when included in the period', async () => {
    const response = await postUsersQuery({ dateRange: '30days' }, isolated.authHeaders);

    expect(response.status).toBe(200);
    const body = await response.json();
    const anonymousUser = body.users.find((user: { id: string }) => user.id === '5');

    expect(anonymousUser).toEqual({
      id: '5',
      identifier: null,
      displayName: null,
      country: 'DE',
      city: 'Berlin',
      lastSeenAt: '2025-12-25T08:01:00Z',
      lastEventFiredAt: null,
      avatarUrl: null,
      anonymous: true,
    });
  });

  it('supports filtering anonymous users via user filter', async () => {
    const response = await postUsersQuery(
      {
        dateRange: '30days',
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
          displayName: null,
          lastEventFiredAt: null,
        },
      ],
    });
  });

  it('returns a single user by id', async () => {
    const response = await getSingleUser({ id: '3' }, isolated.authHeaders);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        id: '3',
        identifier: 'user-3',
        displayName: 'Bravo',
        country: 'US',
        city: 'San Francisco',
        lastSeenAt: '2026-01-19T09:15:00Z',
        avatarUrl: null,
        anonymous: false,
      },
    });
  });

  it('returns a single user by identifier', async () => {
    const response = await getSingleUser({ identifier: 'user-1' }, isolated.authHeaders);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        id: '1',
        identifier: 'user-1',
        displayName: 'Zulu',
        country: 'US',
        city: 'New York',
        lastSeenAt: '2026-01-18T09:02:00Z',
        avatarUrl: null,
        anonymous: false,
      },
    });
  });

  it('returns 404 when user is not found', async () => {
    const response = await getSingleUser({ identifier: 'does-not-exist@example.com' }, isolated.authHeaders);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      },
    });
  });

  it('returns single anonymous user data from latest event when requested by id', async () => {
    const response = await getSingleUser({ id: '5' }, isolated.authHeaders);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        id: '5',
        identifier: null,
        displayName: null,
        country: 'DE',
        city: 'Berlin',
        lastSeenAt: '2025-12-25T08:01:00Z',
        avatarUrl: null,
        anonymous: true,
      },
    });
  });
});
