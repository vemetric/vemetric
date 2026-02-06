import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicApi } from '../index';
import type { RateLimitRedisClient } from '../middleware/rate-limit';

const { findByKeyHashMock } = vi.hoisted(() => ({
  findByKeyHashMock: vi.fn(),
}));

vi.mock('database', () => ({
  dbApiKey: {
    findByKeyHash: findByKeyHashMock,
  },
}));

describe('GET /api/v1/ping', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const fakeRedis: RateLimitRedisClient = {
    eval: async (..._args) => [1, 60],
  };

  beforeEach(() => {
    delete process.env.REDIS_URL;
    findByKeyHash.mockReset();
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

    const app = createPublicApi({ rateLimitRedisClient: fakeRedis });

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
