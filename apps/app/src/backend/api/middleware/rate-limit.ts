import { createMiddleware } from 'hono/factory';
import { getRedisClient } from '../../utils/redis';
import type { PublicApiHonoEnv } from '../types';
import { ApiError } from '../utils/errors';

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_SEC = 60;

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { current, ttl }
`;

type RateLimitMiddlewareOptions = {
  limit?: number;
  windowSec?: number;
};

function resolveOptions(options: RateLimitMiddlewareOptions) {
  return {
    limit: options.limit ?? DEFAULT_LIMIT,
    windowSec: options.windowSec ?? DEFAULT_WINDOW_SEC,
  };
}

/**
 * Advertises the rate-limit policy (`RateLimit-Policy`) on every API response,
 * including the ones rejected before a project is known (e.g. 401).
 */
export function createRateLimitPolicyMiddleware(options: RateLimitMiddlewareOptions = {}) {
  const { limit, windowSec } = resolveOptions(options);

  return createMiddleware<PublicApiHonoEnv>(async (c, next) => {
    c.header('RateLimit-Policy', `${limit};w=${windowSec}`);
    await next();
  });
}

export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions = {}) {
  const { limit, windowSec } = resolveOptions(options);

  return createMiddleware<PublicApiHonoEnv>(async (c, next) => {
    const project = c.get('project');
    if (!project) {
      await next();
      return;
    }

    const redisKey = `ratelimit:api:${project.id}`;
    const redisClient = await getRedisClient();
    const result = await redisClient.eval(RATE_LIMIT_SCRIPT, {
      keys: [redisKey],
      arguments: [String(windowSec)],
    });
    if (!Array.isArray(result) || result.length < 2) {
      throw new Error('Invalid rate-limit script response');
    }

    const [rawCurrent, rawTtl] = result as [number | string, number | string];
    const current = Number(rawCurrent);
    const ttl = Number(rawTtl);
    const ttlSec = ttl > 0 ? ttl : windowSec;
    const remaining = Math.max(0, limit - current);
    const resetAt = Math.ceil(Date.now() / 1000) + ttlSec;

    c.header('RateLimit-Limit', String(limit));
    c.header('RateLimit-Remaining', String(remaining));
    c.header('RateLimit-Reset', String(ttlSec));
    // Legacy headers, kept for existing clients. X-RateLimit-Reset is a unix timestamp.
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetAt));

    if (current > limit) {
      c.header('Retry-After', String(ttlSec));
      throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Rate limit exceeded. Try again shortly.');
    }

    await next();
  });
}
