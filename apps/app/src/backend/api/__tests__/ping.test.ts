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

describe('GET /api/v1/ping', () => {
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
    findByKeyHash.mockResolvedValueOnce({
      id: 'key_123',
      projectId: '100',
      project: {
        id: '100',
        name: 'Public API Project',
      },
    });

    const app = createPublicApi();

    const response = await app.request('/v1/ping', {
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      project: {
        id: '100',
        name: 'Public API Project',
      },
    });
  });
});
