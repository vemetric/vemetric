import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import Redis from 'ioredis';
import type { PublicApiEnv } from './auth';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

const LIMIT = 1000;
const WINDOW_SEC = 60;

export const rateLimitMiddleware = createMiddleware<PublicApiEnv>(async (c, next) => {
  const project = c.get('project');
  if (!project) return next();

  const redisKey = `ratelimit:api:${project.id}`;
  const current = await redis.incr(redisKey);

  if (current === 1) {
    await redis.expire(redisKey, WINDOW_SEC);
  }

  const ttl = await redis.ttl(redisKey);
  const remaining = Math.max(0, LIMIT - current);

  if (current > LIMIT) {
    c.header('X-RateLimit-Limit', String(LIMIT));
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + ttl));
    throw new HTTPException(429, { message: 'Rate limit exceeded. Try again shortly.' });
  }

  await next();

  c.header('X-RateLimit-Limit', String(LIMIT));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + ttl));
});
