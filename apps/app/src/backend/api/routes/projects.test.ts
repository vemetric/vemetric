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

describe('GET /api/v1/project', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;

  beforeEach(() => {
    findByKeyHash.mockReset();
    getRedisClient.mockReset();
    getRedisClient.mockResolvedValue({
      eval: vi.fn().mockResolvedValue([1, 60]),
    });
  });

  it('returns associated project info for a valid API key', async () => {
    const createdAt = new Date('2026-02-07T12:00:00.000Z');
    const firstEventAt = new Date('2026-02-07T12:30:00.000Z');

    findByKeyHash.mockResolvedValueOnce({
      id: 'key_123',
      projectId: '100',
      project: {
        id: '100',
        name: 'Public API Project',
        domain: 'example.com',
        token: 'project_token_123',
        createdAt,
        firstEventAt,
        publicDashboard: true,
        excludedIps: '127.0.0.1,10.0.0.2',
        excludedCountries: 'DE,AT',
      },
    });

    const app = createPublicApi();

    const response = await app.request('/v1/project', {
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      project: {
        id: '100',
        name: 'Public API Project',
        domain: 'example.com',
        token: 'project_token_123',
        createdAt: createdAt.toISOString(),
        firstEventAt: firstEventAt.toISOString(),
        hasPublicDashboard: true,
        excludedIps: ['127.0.0.1', '10.0.0.2'],
        excludedCountries: ['DE', 'AT'],
      },
    });
  });
});
