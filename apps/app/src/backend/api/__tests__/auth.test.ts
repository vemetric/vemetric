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

describe('public API auth middleware', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;

  beforeEach(() => {
    findByKeyHash.mockReset();
    getRedisClient.mockReset();
    getRedisClient.mockResolvedValue({
      eval: vi.fn().mockResolvedValue([1, 60]),
    });
  });

  it('returns 401 for missing authorization header', async () => {
    const app = createPublicApi();

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
    const app = createPublicApi();

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

  it('returns 401 for invalid API key format and skips db lookup', async () => {
    const app = createPublicApi();

    const response = await app.request('/v1/ping', {
      headers: {
        Authorization: 'Bearer invalid-format',
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key format',
      },
    });
    expect(findByKeyHash).not.toHaveBeenCalled();
  });

  it('returns 401 for overlong API key and skips db lookup', async () => {
    const app = createPublicApi();
    const veryLongKey = `vem_${'a'.repeat(5000)}`;

    const response = await app.request('/v1/ping', {
      headers: {
        Authorization: `Bearer ${veryLongKey}`,
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key format',
      },
    });
    expect(findByKeyHash).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid or revoked key', async () => {
    findByKeyHash.mockResolvedValueOnce(null);

    const app = createPublicApi();

    const response = await app.request('/v1/ping', {
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
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

    const app = createPublicApi();

    const response = await app.request('/v1/ping', {
      headers: {
        Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
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
