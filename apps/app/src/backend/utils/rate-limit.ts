/**
 * Simple in-memory rate limiter for email sending.
 * Uses a Map to track timestamps of last sent emails per key.
 * Cleanup of expired entries happens lazily on record.
 */
export function createRateLimiter(cooldownMs: number) {
  const timestamps = new Map<string, number>();
  let lastCleanup = Date.now();

  const cleanup = () => {
    const now = Date.now();
    // Only cleanup once per cooldown period to avoid overhead
    if (now - lastCleanup < cooldownMs) return;

    lastCleanup = now;
    timestamps.forEach((timestamp, key) => {
      if (now - timestamp >= cooldownMs) {
        timestamps.delete(key);
      }
    });
  };

  return {
    /**
     * Check if the action is allowed for the given key.
     * @returns true if allowed, false if rate limited
     */
    isAllowed(key: string): boolean {
      const lastSent = timestamps.get(key);
      if (lastSent && Date.now() - lastSent < cooldownMs) {
        return false;
      }
      return true;
    },

    /**
     * Record that an action was performed for the given key.
     */
    record(key: string): void {
      timestamps.set(key, Date.now());
      cleanup();
    },

    /**
     * Check if allowed and record if so. Returns true if allowed.
     */
    tryAcquire(key: string): boolean {
      if (!this.isAllowed(key)) {
        return false;
      }
      this.record(key);
      return true;
    },
  };
}

// 5 minute cooldown for email verification
export const emailVerificationRateLimiter = createRateLimiter(5 * 60 * 1000);

// 5 minute cooldown for project deletion emails
export const projectDeletionRateLimiter = createRateLimiter(5 * 60 * 1000);
