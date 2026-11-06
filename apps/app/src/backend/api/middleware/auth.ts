import { createHash } from 'node:crypto';
import { dbApiKey, type AuthenticatedApiKey } from 'database';
import { createMiddleware } from 'hono/factory';
import { getSubscriptionStatus, type SubscriptionStatus } from '../../utils/billing';
import type { PublicApiHonoEnv } from '../types';
import { ApiError } from '../utils/errors';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const API_KEY_LENGTH = 36;
const API_KEY_PREFIX = 'vem_';

export type ApiKeyAuthentication = {
  apiKey: AuthenticatedApiKey;
  subscriptionStatus: SubscriptionStatus;
};

/** Looks up the API key of an `Authorization: Bearer <key>` header. Shared by the REST API and the MCP server. */
export async function authenticateApiKey(authHeader: string | undefined): Promise<ApiKeyAuthentication> {
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

  const subscriptionStatus = apiKey.organization
    ? await getSubscriptionStatus(apiKey.organization)
    : {
        isActive: false,
        isPastDue: false,
        priceId: undefined,
        customPlanEvents: null,
      };

  return { apiKey, subscriptionStatus };
}

export const authMiddleware = createMiddleware<PublicApiHonoEnv>(async (c, next) => {
  const { apiKey, subscriptionStatus } = await authenticateApiKey(c.req.header('Authorization'));
  c.set('apiKey', apiKey);
  c.set('subscriptionStatus', subscriptionStatus);

  await next();
});
