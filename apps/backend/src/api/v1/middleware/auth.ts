import { dbApiKey } from 'database';
import type { Context, Next } from 'hono';
import type { ApiContextVars, SubscriptionTier } from '../types';

function getSubscriptionTier(billingInfo: { productId: string } | null | undefined): SubscriptionTier {
  // If there's billing info with a product, the user is on the paid plan
  if (billingInfo?.productId) {
    return 'paid';
  }
  return 'free';
}

export async function apiKeyAuth(c: Context<{ Variables: ApiContextVars }>, next: Next) {
  // Extract API key from headers
  const authHeader = c.req.header('Authorization');
  const apiKeyHeader = c.req.header('X-API-Key');

  let apiKeyValue: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    apiKeyValue = authHeader.slice(7);
  } else if (apiKeyHeader) {
    apiKeyValue = apiKeyHeader;
  }

  if (!apiKeyValue) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'API key is required. Use Authorization: Bearer <key> or X-API-Key header.',
        },
      },
      401,
    );
  }

  // Validate API key format
  if (!apiKeyValue.startsWith('vm_sk_')) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key format. Keys should start with vm_sk_',
        },
      },
      401,
    );
  }

  // Validate and get API key from database
  const apiKey = await dbApiKey.validateAndGet(apiKeyValue);

  if (!apiKey) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired API key',
        },
      },
      401,
    );
  }

  // Check if project ID in URL matches the API key's project
  const projectIdParam = c.req.param('projectId');
  if (projectIdParam && projectIdParam !== apiKey.projectId) {
    return c.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'API key does not have access to this project',
        },
      },
      403,
    );
  }

  // Determine subscription tier
  const subscriptionTier = getSubscriptionTier(apiKey.project.organization.billingInfo);

  // Set context
  c.set('api', {
    apiKey,
    projectId: BigInt(apiKey.projectId),
    project: apiKey.project,
    organization: apiKey.project.organization,
    subscriptionTier,
  });

  await next();
}
