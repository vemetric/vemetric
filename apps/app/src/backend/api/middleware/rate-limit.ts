import { createMiddleware } from 'hono/factory';
import Redis from 'ioredis';
import { ApiError } from '../lib/errors';
import type { PublicApiEnv } from '../types';

const LIMIT = 1000;
const WINDOW_SEC = 60;

export type RateLimitRedisClient = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  ttl: (key: string) => Promise<number>;
};

function getRedisClient(): RateLimitRedisClient {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is required to start the public API');
  }

  return new Redis(process.env.REDIS_URL);
}

export function createRateLimitMiddleware(redis: RateLimitRedisClient = getRedisClient()) {
  return createMiddleware<PublicApiEnv>(async (c, next) => {
    const project = c.get('project');
    if (!project) {
      await next();
      return;
    }

    const redisKey = `ratelimit:api:${project.id}`;
    const current = await redis.incr(redisKey);

    if (current === 1) {
      await redis.expire(redisKey, WINDOW_SEC);
    }

    const ttl = await redis.ttl(redisKey);
    const ttlSec = ttl > 0 ? ttl : WINDOW_SEC;
    const remaining = Math.max(0, LIMIT - current);
    const resetAt = Math.ceil(Date.now() / 1000) + ttlSec;

    c.header('X-RateLimit-Limit', String(LIMIT));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetAt));

    if (current > LIMIT) {
      throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Rate limit exceeded. Try again shortly.');
    }

    await next();
  });
}
