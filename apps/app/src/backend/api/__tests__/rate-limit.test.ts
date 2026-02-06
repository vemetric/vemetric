import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../lib/errors';
import { createRateLimitMiddleware, type RateLimitRedisClient } from '../middleware/rate-limit';
import type { PublicApiEnv } from '../types';

class FakeRedis implements RateLimitRedisClient {
  private counts = new Map<string, number>();
  private ttls = new Map<string, number>();

  async eval(...args: Array<string | number>): Promise<[number, number]> {
    const key = String(args[2]);
    const windowSec = Number(args[3]);
    const current = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, current);
    if (current === 1) {
      this.ttls.set(key, windowSec);
    }
    return [current, this.ttls.get(key) ?? windowSec];
  }
}

function createTestApp(redis: RateLimitRedisClient) {
  const app = new Hono<PublicApiEnv>();
  app.onError(errorHandler);

  app.use('/v1/*', async (c, next) => {
    c.set('project', {
      id: 'project_1',
      name: 'Test Project',
    } as PublicApiEnv['Variables']['project']);

    await next();
  });

  app.use('/v1/*', createRateLimitMiddleware(redis));
  app.get('/v1/ping', (c) => c.json({ status: 'ok' }));

  return app;
}

describe('public API rate limit middleware', () => {
  it('allows requests under limit and sets rate limit headers', async () => {
    const app = createTestApp(new FakeRedis());

    const response = await app.request('/v1/ping');

    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('1000');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('999');
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('returns 429 when over limit', async () => {
    const redis = new FakeRedis();
    const app = createTestApp(redis);

    let response: Response | null = null;
    for (let i = 0; i < 1001; i++) {
      response = await app.request('/v1/ping');
    }

    const body = await response!.json();

    expect(response!.status).toBe(429);
    expect(response!.headers.get('X-RateLimit-Limit')).toBe('1000');
    expect(response!.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(body).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Try again shortly.',
      },
    });
  });
});
