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

const AUTH_HEADERS = {
  Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
  'Content-Type': 'application/json',
};

function createMockApiKey() {
  return {
    id: 'key_1',
    projectId: '123',
    project: {
      id: '123',
      name: 'Demo Project',
      domain: 'demo.example.com',
      token: 'project_token_123',
      createdAt: new Date('2026-02-07T12:00:00.000Z'),
      firstEventAt: new Date('2026-02-07T12:30:00.000Z'),
      publicDashboard: false,
      excludedIps: null,
      excludedCountries: null,
    },
  };
}

function expectValidationDetail(
  body: {
    error: {
      details: Array<{ field: string; message: string }>;
    };
  },
  field: string,
  message: string,
) {
  expect(body.error.details).toEqual(
    expect.arrayContaining([
      {
        field,
        message,
      },
    ]),
  );
}

describe('POST /api/v1/users (contract)', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;

  beforeEach(() => {
    findByKeyHash.mockReset();
    getRedisClient.mockReset();

    findByKeyHash.mockResolvedValue(createMockApiKey());
    getRedisClient.mockResolvedValue({
      eval: vi.fn().mockResolvedValue([1, 60]),
    });
  });

  describe('validation', () => {
    it('rejects reversed custom date_range', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/users', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          date_range: ['2026-02-18', '2026-02-17'],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expectValidationDetail(body, 'date_range', 'Start date must be before or equal to end date');
    });

    it('rejects invalid order_by field', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/users', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          order_by: [['users', 'desc']],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expectValidationDetail(body, 'order_by.0', 'Invalid input');
    });

    it('rejects invalid order_by direction', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/users', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          order_by: [['last_seen_at', 'sideways']],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expectValidationDetail(body, 'order_by.0', 'Invalid input');
    });

    it('rejects more than one order_by item', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/users', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          order_by: [
            ['last_seen_at', 'desc'],
            ['identifier', 'asc'],
          ],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expectValidationDetail(body, 'order_by', 'order_by can include max one item');
    });

    it('rejects event filter for non-event order_by fields', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/users', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          order_by: [
            [
              'display_name',
              'asc',
              {
                name: {
                  operator: 'eq',
                  value: 'signup',
                },
              },
            ],
          ],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expectValidationDetail(body, 'order_by.0', 'Array must contain at most 2 element(s)');
    });

    it('rejects last_event_fired order_by without event filter', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/users', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          order_by: [['last_event_fired', 'desc']],
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expectValidationDetail(body, 'order_by.0', 'Invalid input');
    });
  });

  describe('plan_limit', () => {
    it('rejects disallowed preset date_range', async () => {
      const app = createPublicApi();

      const response = await app.request('/v1/users', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          date_range: '1year',
        }),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'PLAN_LIMIT_EXCEEDED',
        },
      });
    });
  });
});

describe('GET /api/v1/users/single (contract)', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;

  beforeEach(() => {
    findByKeyHash.mockReset();
    getRedisClient.mockReset();

    findByKeyHash.mockResolvedValue(createMockApiKey());
    getRedisClient.mockResolvedValue({
      eval: vi.fn().mockResolvedValue([1, 60]),
    });
  });

  it('rejects when id and identifier are both missing', async () => {
    const app = createPublicApi();

    const response = await app.request('/v1/users/single', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expectValidationDetail(body, 'id', 'Provide exactly one of id or identifier');
    expectValidationDetail(body, 'identifier', 'Provide exactly one of id or identifier');
  });

  it('rejects when id and identifier are both provided', async () => {
    const app = createPublicApi();

    const response = await app.request('/v1/users/single?id=1&identifier=user-1', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expectValidationDetail(body, 'id', 'Provide exactly one of id or identifier');
    expectValidationDetail(body, 'identifier', 'Provide exactly one of id or identifier');
  });

  it('rejects non-numeric id', async () => {
    const app = createPublicApi();

    const response = await app.request('/v1/users/single?id=abc', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expectValidationDetail(body, 'id', 'id must be a numeric user id');
  });
});
