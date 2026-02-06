import { createMiddleware } from 'hono/factory';
import { getRedisClient } from '../../utils/redis';
import { ApiError } from '../lib/errors';
import type { PublicApiEnv } from '../types';

const LIMIT = 1000;
const WINDOW_SEC = 60;

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { current, ttl }
`;

export function createRateLimitMiddleware() {
  return createMiddleware<PublicApiEnv>(async (c, next) => {
    const project = c.get('project');
    if (!project) {
      await next();
      return;
    }

    const redisKey = `ratelimit:api:${project.id}`;
    const redisClient = await getRedisClient();
    const result = await redisClient.eval(RATE_LIMIT_SCRIPT, {
      keys: [redisKey],
      arguments: [String(WINDOW_SEC)],
    });
    if (!Array.isArray(result) || result.length < 2) {
      throw new Error('Invalid rate-limit script response');
    }

    const [rawCurrent, rawTtl] = result as [number | string, number | string];
    const current = Number(rawCurrent);
    const ttl = Number(rawTtl);
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
