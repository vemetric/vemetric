import type { Context, Next } from 'hono';
import type { ApiContextVars, SubscriptionTier } from '../types';

interface RateLimitConfig {
  requestsPerHour: number;
  burstPer10s: number;
}

const RATE_LIMITS: Record<SubscriptionTier, RateLimitConfig> = {
  free: { requestsPerHour: 600, burstPer10s: 20 },
  professional: { requestsPerHour: 6000, burstPer10s: 100 },
  enterprise: { requestsPerHour: 60000, burstPer10s: 1000 },
};

// In-memory rate limiting (for now, can be replaced with Redis later)
const rateLimitStore = new Map<string, { count: number; resetAt: number; burstCount: number; burstResetAt: number }>();

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now && value.burstResetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

export async function rateLimitMiddleware(c: Context<{ Variables: ApiContextVars }>, next: Next) {
  const apiContext = c.get('api');
  if (!apiContext) {
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'API context not found',
        },
      },
      500,
    );
  }

  const { apiKey, subscriptionTier } = apiContext;
  const limits = RATE_LIMITS[subscriptionTier];
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const tenSecondsMs = 10 * 1000;

  const key = apiKey.id;
  let entry = rateLimitStore.get(key);

  if (!entry) {
    entry = {
      count: 0,
      resetAt: now + hourMs,
      burstCount: 0,
      burstResetAt: now + tenSecondsMs,
    };
    rateLimitStore.set(key, entry);
  }

  // Reset counters if windows have expired
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + hourMs;
  }

  if (now >= entry.burstResetAt) {
    entry.burstCount = 0;
    entry.burstResetAt = now + tenSecondsMs;
  }

  // Check burst limit
  if (entry.burstCount >= limits.burstPer10s) {
    const retryAfter = Math.ceil((entry.burstResetAt - now) / 1000);
    c.header('X-RateLimit-Limit', String(limits.requestsPerHour));
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    c.header('Retry-After', String(retryAfter));

    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.',
        },
      },
      429,
    );
  }

  // Check hourly limit
  if (entry.count >= limits.requestsPerHour) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    c.header('X-RateLimit-Limit', String(limits.requestsPerHour));
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    c.header('Retry-After', String(retryAfter));

    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded. Please try again later.',
        },
      },
      429,
    );
  }

  // Increment counters
  entry.count++;
  entry.burstCount++;

  // Set rate limit headers
  c.header('X-RateLimit-Limit', String(limits.requestsPerHour));
  c.header('X-RateLimit-Remaining', String(limits.requestsPerHour - entry.count));
  c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  await next();
}
