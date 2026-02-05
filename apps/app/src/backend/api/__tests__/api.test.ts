import { createHash } from 'crypto';
import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPublicApi } from '../index';

// ── Mocks (vi.mock is hoisted automatically) ──────────────

const mockFindFirst = vi.fn();

vi.mock('database', () => ({
  prismaClient: {
    apiKey: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

const mockRedisIncr = vi.fn();
const mockRedisExpire = vi.fn();
const mockRedisTtl = vi.fn();

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      incr: (...args: unknown[]) => mockRedisIncr(...args),
      expire: (...args: unknown[]) => mockRedisExpire(...args),
      ttl: (...args: unknown[]) => mockRedisTtl(...args),
    })),
  };
});

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const TEST_KEY = 'vem_test1234567890abcdefghijklmnop';
const TEST_KEY_HASH = sha256(TEST_KEY);

const mockProject = {
  id: 'proj_123',
  name: 'Test Project',
  domain: 'example.com',
  token: 'tok_abc',
  organizationId: 'org_1',
  createdAt: new Date(),
  publicDashboard: false,
  eventIcons: {},
  firstEventAt: null,
  excludedIps: null,
  excludedCountries: null,
};

const mockApiKey = {
  id: 'key_abc',
  projectId: 'proj_123',
  name: 'Test Key',
  keyHash: TEST_KEY_HASH,
  keyPrefix: 'vem_test1234...',
  createdAt: new Date(),
  revokedAt: null,
  project: mockProject,
};

function createApp() {
  const root = new Hono();
  root.route('/api', createPublicApi());
  return root;
}

// ── Tests ──────────────────────────────────────────────────

describe('Public API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: valid key, under rate limit
    mockFindFirst.mockResolvedValue(mockApiKey);
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisTtl.mockResolvedValue(60);
  });

  // ── Auth middleware ───────────────────────────────────

  describe('Auth middleware', () => {
    it('should reject request with no Authorization header', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/ping');

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toContain('Missing API key');
    });

    it('should reject request with malformed Authorization header', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: 'Basic abc123' },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toContain('Missing API key');
    });

    it('should reject request with invalid API key', async () => {
      mockFindFirst.mockResolvedValue(null);

      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: 'Bearer vem_invalid_key_here' },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toContain('Invalid or revoked');
    });

    it('should reject revoked API key', async () => {
      // findFirst with revokedAt: null won't match a revoked key → returns null
      mockFindFirst.mockResolvedValue(null);

      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(res.status).toBe(401);
    });

    it('should accept valid API key', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(res.status).toBe(200);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { keyHash: TEST_KEY_HASH, revokedAt: null },
        include: { project: true },
      });
    });

    it('should hash the key with SHA-256 for lookup', async () => {
      const app = createApp();
      await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ keyHash: TEST_KEY_HASH }),
        }),
      );
    });
  });

  // ── Rate limiting ─────────────────────────────────────

  describe('Rate limiting', () => {
    it('should allow requests under the limit', async () => {
      mockRedisIncr.mockResolvedValue(500);

      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(res.status).toBe(200);
    });

    it('should set X-RateLimit headers on successful responses', async () => {
      mockRedisIncr.mockResolvedValue(10);
      mockRedisTtl.mockResolvedValue(45);

      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('990');
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('should return 429 when rate limit is exceeded', async () => {
      mockRedisIncr.mockResolvedValue(1001);
      mockRedisTtl.mockResolvedValue(30);

      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error.message).toContain('Rate limit exceeded');
    });

    it('should set expire on first request in window', async () => {
      mockRedisIncr.mockResolvedValue(1);

      const app = createApp();
      await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(mockRedisExpire).toHaveBeenCalledWith(`ratelimit:api:${mockProject.id}`, 60);
    });

    it('should not set expire when not first request in window', async () => {
      mockRedisIncr.mockResolvedValue(5);

      const app = createApp();
      await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(mockRedisExpire).not.toHaveBeenCalled();
    });

    it('should set remaining to 0 when at the limit', async () => {
      mockRedisIncr.mockResolvedValue(1000);

      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });

  // ── Ping route ────────────────────────────────────────

  describe('GET /v1/ping', () => {
    it('should return project info with valid key', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        status: 'ok',
        project: {
          id: 'proj_123',
          name: 'Test Project',
        },
      });
    });
  });

  // ── Docs (no auth required) ───────────────────────────

  describe('Docs endpoints', () => {
    it('should serve OpenAPI spec without auth', async () => {
      const app = createApp();
      const res = await app.request('/api/openapi.json');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.openapi).toBe('3.0.0');
      expect(body.info.title).toBe('Vemetric API');
    });

    it('should serve Swagger UI without auth', async () => {
      const app = createApp();
      const res = await app.request('/api/docs');

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('swagger');
    });
  });

  // ── Error handling ────────────────────────────────────

  describe('Error handling', () => {
    it('should return consistent error format for 401', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/ping');

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
    });

    it('should return consistent error format for 429', async () => {
      mockRedisIncr.mockResolvedValue(1001);
      mockRedisTtl.mockResolvedValue(30);

      const app = createApp();
      const res = await app.request('/api/v1/ping', {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
    });
  });
});
