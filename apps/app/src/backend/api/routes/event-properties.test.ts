import type * as clickhouse from 'clickhouse';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicApi } from '../index';

const { findByKeyHashMock, getRedisClientMock, getEventPropertiesMock } = vi.hoisted(() => ({
  findByKeyHashMock: vi.fn(),
  getRedisClientMock: vi.fn(),
  getEventPropertiesMock: vi.fn(),
}));

vi.mock('database', () => ({
  dbApiKey: {
    findByKeyHash: findByKeyHashMock,
  },
}));

vi.mock('../../utils/redis', () => ({
  getRedisClient: getRedisClientMock,
}));

vi.mock('clickhouse', async (importOriginal) => ({
  ...(await importOriginal<typeof clickhouse>()),
  clickhouseEvent: {
    getEventProperties: getEventPropertiesMock,
  },
}));

const AUTH_HEADERS = {
  Authorization: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
  'Content-Type': 'application/json',
};

function createMockApiKey() {
  return {
    id: 'key_1',
    organizationId: 'org_1',
    projectId: '123',
    allProjects: false,
    projects: [],
    project: {
      id: '123',
      name: 'Demo Project',
      domain: 'demo.example.com',
      token: 'project_token_123',
      organizationId: 'org_1',
      createdAt: new Date('2026-02-07T12:00:00.000Z'),
      firstEventAt: new Date('2026-02-07T12:30:00.000Z'),
      publicDashboard: false,
      excludedIps: null,
      excludedCountries: null,
    },
  };
}

function request(body: unknown) {
  return createPublicApi().request('/v1/events/properties', {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/events/properties (contract)', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;
  const getEventProperties = getEventPropertiesMock as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    findByKeyHash.mockResolvedValue(createMockApiKey());
    getRedisClient.mockResolvedValue({ eval: vi.fn().mockResolvedValue([1, 60]) });
    getEventProperties.mockResolvedValue([
      { eventName: 'purchase', name: 'amount', count: 8, users: 6 },
      { eventName: 'signup', name: 'plan', count: 40, users: 30 },
      { eventName: 'signup', name: 'source', count: 12, users: 10 },
      { eventName: 'signup', name: 'coupon', count: 3, users: 3 },
    ]);
  });

  it('returns one paginated property list per event, in the requested order', async () => {
    const response = await request({ eventNames: ['signup', 'purchase', 'click'], dateRange: '30days', limit: 2 });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.query).toEqual({
      eventNames: ['signup', 'purchase', 'click'],
      dateRange: '30days',
      limit: 2,
      offset: 0,
    });
    expect(body.data).toEqual([
      {
        eventName: 'signup',
        pagination: { limit: 2, offset: 0, returned: 2 },
        properties: [
          { name: 'plan', events: 40, users: 30 },
          { name: 'source', events: 12, users: 10 },
        ],
      },
      {
        eventName: 'purchase',
        pagination: { limit: 2, offset: 0, returned: 1 },
        properties: [{ name: 'amount', events: 8, users: 6 }],
      },
      { eventName: 'click', pagination: { limit: 2, offset: 0, returned: 0 }, properties: [] },
    ]);
    expect(getEventProperties).toHaveBeenCalledTimes(1);
    expect(getEventProperties).toHaveBeenCalledWith(
      BigInt(123),
      ['signup', 'purchase', 'click'],
      expect.objectContaining({ filterQueries: '' }),
    );
  });

  it('pages through the properties of each event', async () => {
    const response = await request({ eventNames: ['signup'], dateRange: '30days', limit: 2, offset: 2 });

    const body = await response.json();
    expect(body.data[0].properties).toEqual([{ name: 'coupon', events: 3, users: 3 }]);
  });

  it('rejects missing, empty and duplicate event names', async () => {
    for (const [eventNames, field, message] of [
      [undefined, 'eventNames', 'Invalid input: expected array, received undefined'],
      [[], 'eventNames', 'eventNames must include at least one item'],
      [['signup', 'signup'], 'eventNames', 'eventNames must not contain duplicates'],
      [['signup', ' '], 'eventNames.1', 'event names must not be empty'],
    ] as const) {
      const response = await request({ eventNames, dateRange: '30days' });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toEqual(expect.arrayContaining([{ field, message }]));
    }
  });

  it('rejects a reversed custom dateRange', async () => {
    const response = await request({ eventNames: ['signup'], dateRange: ['2026-02-18', '2026-02-17'] });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.details).toEqual(
      expect.arrayContaining([{ field: 'dateRange', message: 'Start date must be before or equal to end date' }]),
    );
  });

  it('applies the plan limits', async () => {
    const response = await request({ eventNames: ['signup'], dateRange: '1year' });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PLAN_LIMIT_EXCEEDED' } });
    expect(getEventProperties).not.toHaveBeenCalled();
  });
});
