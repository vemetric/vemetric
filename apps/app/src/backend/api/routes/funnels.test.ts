import { clickhouseEvent } from 'clickhouse';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicApi } from '../index';

const { findByKeyHashMock, findByProjectIdMock, findByIdMock, getRedisClientMock } = vi.hoisted(() => ({
  findByKeyHashMock: vi.fn(),
  findByProjectIdMock: vi.fn(),
  findByIdMock: vi.fn(),
  getRedisClientMock: vi.fn(),
}));

vi.mock('database', () => ({
  dbApiKey: {
    findByKeyHash: findByKeyHashMock,
  },
  dbFunnel: {
    findByProjectId: findByProjectIdMock,
    findById: findByIdMock,
  },
}));

vi.mock('../../utils/redis', () => ({
  getRedisClient: getRedisClientMock,
}));

describe('GET /api/v1/funnels', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const findByProjectId = findByProjectIdMock as Mock;
  const findById = findByIdMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;
  const getFunnelResultsSpy = vi.spyOn(clickhouseEvent, 'getFunnelResults');
  const getActiveUsersSpy = vi.spyOn(clickhouseEvent, 'getActiveUsers');

  beforeEach(() => {
    findByKeyHash.mockReset();
    findByProjectId.mockReset();
    findById.mockReset();
    getRedisClient.mockReset();
    getFunnelResultsSpy.mockReset();
    getActiveUsersSpy.mockReset();
    getRedisClient.mockResolvedValue({
      eval: vi.fn().mockResolvedValue([1, 60]),
    });
  });

  function mockValidApiKey() {
    findByKeyHash.mockResolvedValueOnce({
      id: 'key_123',
      projectId: '100',
      project: {
        id: '100',
        name: 'Public API Project',
        domain: 'example.com',
        token: 'project_token_123',
        createdAt: new Date('2026-02-07T12:00:00.000Z'),
        firstEventAt: null,
        publicDashboard: false,
        excludedIps: '',
        excludedCountries: '',
      },
    });
  }

  it('returns 401 when Authorization header is missing', async () => {
    const app = createPublicApi();
    const response = await app.request('/v1/funnels', { method: 'GET' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing API key. Use Authorization: Bearer <key>',
      },
    });
  });

  it('returns an empty list when project has no funnels', async () => {
    mockValidApiKey();
    findByProjectId.mockResolvedValueOnce([]);

    const app = createPublicApi();
    const response = await app.request('/v1/funnels', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      funnels: [],
    });
  });

  it('returns saved funnels for the authenticated project', async () => {
    const createdAt = new Date('2026-03-01T10:00:00.000Z');
    const updatedAt = new Date('2026-03-02T11:30:00.000Z');

    mockValidApiKey();

    findByProjectId.mockResolvedValueOnce([
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '100',
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
            name: 'Checkout',
            filter: {
              type: 'event',
              nameFilter: {
                operator: 'is',
                value: 'PurchaseCompleted',
              },
            },
          },
        ],
        createdAt,
        updatedAt,
      },
    ]);

    const app = createPublicApi();
    const response = await app.request('/v1/funnels', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      funnels: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
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
              name: 'Checkout',
              filter: {
                type: 'event',
                name: {
                  operator: 'eq',
                  value: 'PurchaseCompleted',
                },
              },
            },
          ],
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ],
    });
  });

  it('returns funnel results for a single funnel', async () => {
    const createdAt = new Date('2026-03-01T10:00:00.000Z');
    const updatedAt = new Date('2026-03-02T11:30:00.000Z');
    const funnelId = '550e8400-e29b-41d4-a716-446655440000';

    mockValidApiKey();
    findById.mockResolvedValueOnce({
      id: funnelId,
      projectId: '100',
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
          name: 'Checkout',
          filter: {
            type: 'event',
            nameFilter: {
              operator: 'is',
              value: 'PurchaseCompleted',
            },
          },
        },
      ],
      createdAt,
      updatedAt,
    });
    getFunnelResultsSpy.mockResolvedValueOnce([
      { funnelStage: 1, userCount: 120 },
      { funnelStage: 2, userCount: 45 },
    ]);
    getActiveUsersSpy.mockResolvedValueOnce(230);

    const app = createPublicApi();
    const response = await app.request(`/v1/funnels/${funnelId}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRange: ['2026-03-01', '2026-03-02'],
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      period: {
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-02T23:59:59Z',
      },
      query: {
        dateRange: ['2026-03-01', '2026-03-02'],
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
            name: 'Checkout',
            filter: {
              type: 'event',
              name: {
                operator: 'eq',
                value: 'PurchaseCompleted',
              },
            },
          },
        ],
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
      results: {
        activeUsers: 230,
        steps: [
          { id: 'step_1', name: 'Step 1', users: 120, conversionRate: 100 },
          { id: 'step_2', name: 'Checkout', users: 45, conversionRate: 37.5 },
        ],
        conversionRate: 37.5,
        activeUserConversionRate: 19.57,
      },
    });
  });

  it('returns 404 when funnel does not exist', async () => {
    const funnelId = '550e8400-e29b-41d4-a716-446655440000';
    mockValidApiKey();
    findById.mockResolvedValueOnce(null);

    const app = createPublicApi();
    const response = await app.request(`/v1/funnels/${funnelId}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRange: '30days',
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'FUNNEL_NOT_FOUND',
        message: 'Funnel not found',
      },
    });
  });

  it('returns 404 when funnel belongs to a different project', async () => {
    const funnelId = '550e8400-e29b-41d4-a716-446655440000';
    mockValidApiKey();
    findById.mockResolvedValueOnce({
      id: funnelId,
      projectId: '999',
      name: 'Other Project Funnel',
      icon: null,
      steps: [],
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      updatedAt: new Date('2026-03-01T10:00:00.000Z'),
    });

    const app = createPublicApi();
    const response = await app.request(`/v1/funnels/${funnelId}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRange: '30days',
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'FUNNEL_NOT_FOUND',
        message: 'Funnel not found',
      },
    });
  });

  it('returns 403 when dateRange exceeds plan retention limits', async () => {
    const funnelId = '550e8400-e29b-41d4-a716-446655440000';
    mockValidApiKey();
    findById.mockResolvedValueOnce({
      id: funnelId,
      projectId: '100',
      name: 'Signup Funnel',
      icon: null,
      steps: [],
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      updatedAt: new Date('2026-03-01T10:00:00.000Z'),
    });

    const app = createPublicApi();
    const response = await app.request(`/v1/funnels/${funnelId}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRange: '1year',
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'PLAN_LIMIT_EXCEEDED',
        message: 'Upgrade to the Professional plan for longer data retention',
      },
    });
  });
});
