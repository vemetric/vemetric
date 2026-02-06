import { createHash } from 'node:crypto';
import { dbApiKey } from 'database';
import { createMiddleware } from 'hono/factory';
import { ApiError } from '../lib/errors';
import type { PublicApiEnv } from '../types';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const API_KEY_LENGTH = 36;
const API_KEY_PREFIX = 'vem_';

export const authMiddleware = createMiddleware<PublicApiEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Missing API key. Use Authorization: Bearer <key>');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Malformed Authorization header. Use Bearer <key>');
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey || rawKey.length !== API_KEY_LENGTH || !rawKey.startsWith(API_KEY_PREFIX)) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid API key format');
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
