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

describe('public API auth middleware', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const fakeRedis: RateLimitRedisClient = {
    incr: async () => 1,
    expire: async () => 1,
    ttl: async () => 60,
  };

  beforeEach(() => {
    delete process.env.REDIS_URL;
    findByKeyHash.mockReset();
  });

  it('throws during startup when REDIS_URL is missing', () => {
    expect(() => createPublicApi()).toThrow('REDIS_URL is required to start the public API');
  });

  it('returns 401 for missing authorization header', async () => {
    const app = createPublicApi({ rateLimitRedisClient: fakeRedis });

    const response = await app.request('/v1/ping');
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing API key. Use Authorization: Bearer <key>',
      },
    });
  });

  it('returns 401 for malformed authorization header', async () => {
    const app = createPublicApi({ rateLimitRedisClient: fakeRedis });

    const response = await app.request('/v1/ping', {
      headers: {
        Authorization: 'Token abc',
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Malformed Authorization header. Use Bearer <key>',
      },
    });
  });

  it('returns 401 for invalid or revoked key', async () => {
    findByKeyHash.mockResolvedValueOnce(null);

    const app = createPublicApi({ rateLimitRedisClient: fakeRedis });

    const response = await app.request('/v1/ping', {
      headers: {
        Authorization: 'Bearer vem_invalid',
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or revoked API key',
      },
    });
  });

  it('passes for a valid key', async () => {
    findByKeyHash.mockResolvedValueOnce({
      id: 'key_1',
      projectId: '123',
      project: {
        id: '123',
        name: 'Demo Project',
      },
    });

    const app = createPublicApi({ rateLimitRedisClient: fakeRedis });

    const response = await app.request('/v1/ping', {
      headers: {
        Authorization: 'Bearer vem_valid_key',
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      project: {
        id: '123',
        name: 'Demo Project',
      },
    });
  });
});
