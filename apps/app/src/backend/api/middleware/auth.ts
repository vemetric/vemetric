import { createHash } from 'node:crypto';
import { dbApiKey } from 'database';
import { createMiddleware } from 'hono/factory';
import { ApiError } from '../lib/errors';
import type { PublicApiEnv } from '../types';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const authMiddleware = createMiddleware<PublicApiEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Missing API key. Use Authorization: Bearer <key>');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Malformed Authorization header. Use Bearer <key>');
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    throw new ApiError(401, 'UNAUTHORIZED', 'API key cannot be empty');
  }

  const keyHash = sha256(rawKey);
  const apiKey = await dbApiKey.findByKeyHash({ keyHash });

  if (!apiKey) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or revoked API key');
  }

  c.set('apiKey', apiKey);
  c.set('project', apiKey.project);

  await next();
});
