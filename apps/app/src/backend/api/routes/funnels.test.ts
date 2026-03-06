import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicApi } from '../index';

const { findByKeyHashMock, findByProjectIdMock, getRedisClientMock } = vi.hoisted(() => ({
  findByKeyHashMock: vi.fn(),
  findByProjectIdMock: vi.fn(),
  getRedisClientMock: vi.fn(),
}));

vi.mock('database', () => ({
  dbApiKey: {
    findByKeyHash: findByKeyHashMock,
  },
  dbFunnel: {
    findByProjectId: findByProjectIdMock,
  },
}));

vi.mock('../../utils/redis', () => ({
  getRedisClient: getRedisClientMock,
}));

describe('GET /api/v1/funnels', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const findByProjectId = findByProjectIdMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;

  beforeEach(() => {
    findByKeyHash.mockReset();
    findByProjectId.mockReset();
    getRedisClient.mockReset();
    getRedisClient.mockResolvedValue({
      eval: vi.fn().mockResolvedValue([1, 60]),
    });
  });

  it('returns saved funnels for the authenticated project', async () => {
    const createdAt = new Date('2026-03-01T10:00:00.000Z');
    const updatedAt = new Date('2026-03-02T11:30:00.000Z');

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

    findByProjectId.mockResolvedValueOnce([
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '100',
        name: 'Signup Funnel',
        icon: 'rocket',
        steps: [
          {
            id: 'step_1',
            name: 'Homepage',
            filter: {
              type: 'page',
              pathFilter: {
                operator: 'is',
                value: '/',
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
              name: 'Homepage',
              filter: {
                type: 'page',
                path: {
                  operator: 'eq',
                  value: '/',
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
});
