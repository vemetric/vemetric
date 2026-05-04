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

describe('POST /api/v1/filters/values (contract)', () => {
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

  it('rejects missing fields', async () => {
    const app = createPublicApi();

    const response = await app.request('/v1/filters/values', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        dateRange: '30days',
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expectValidationDetail(body, 'fields', 'Required');
  });

  it('rejects invalid field token', async () => {
    const app = createPublicApi();

    const response = await app.request('/v1/filters/values', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        dateRange: '30days',
        fields: ['interval:auto'],
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expectValidationDetail(
      body,
      'fields.0',
      "Invalid enum value. Expected 'country' | 'city' | 'page:origin' | 'page:path' | 'browser' | 'deviceType' | 'os' | 'referrer' | 'referrerType' | 'utmCampaign' | 'utmContent' | 'utmMedium' | 'utmSource' | 'utmTerm' | 'event:name', received 'interval:auto'",
    );
  });

  it('rejects duplicate fields', async () => {
    const app = createPublicApi();

    const response = await app.request('/v1/filters/values', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        dateRange: '30days',
        fields: ['country', 'country'],
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expectValidationDetail(body, 'fields', 'fields must not contain duplicates');
  });

  it('rejects reversed custom dateRange', async () => {
    const app = createPublicApi();

    const response = await app.request('/v1/filters/values', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        dateRange: ['2026-02-18', '2026-02-17'],
        fields: ['country'],
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expectValidationDetail(body, 'dateRange', 'Start date must be before or equal to end date');
  });

  it('rejects disallowed preset dateRange', async () => {
    const app = createPublicApi();

    const response = await app.request('/v1/filters/values', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        dateRange: '1year',
        fields: ['country'],
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
