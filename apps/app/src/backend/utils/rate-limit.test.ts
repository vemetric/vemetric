import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isAllowed', () => {
    it('should allow first request for a key', () => {
      const limiter = createRateLimiter(5000);
      expect(limiter.isAllowed('user-1')).toBe(true);
    });

    it('should allow request after cooldown period', () => {
      const limiter = createRateLimiter(5000);

      limiter.record('user-1');

      // Advance time past cooldown
      vi.advanceTimersByTime(5001);

      expect(limiter.isAllowed('user-1')).toBe(true);
    });

    it('should deny request within cooldown period', () => {
      const limiter = createRateLimiter(5000);

      limiter.record('user-1');

      // Still within cooldown
      vi.advanceTimersByTime(4999);

      expect(limiter.isAllowed('user-1')).toBe(false);
    });

    it('should track different keys independently', () => {
      const limiter = createRateLimiter(5000);

      limiter.record('user-1');

      expect(limiter.isAllowed('user-1')).toBe(false);
      expect(limiter.isAllowed('user-2')).toBe(true);
    });
  });

  describe('tryAcquire', () => {
    it('should return true and record on first attempt', () => {
      const limiter = createRateLimiter(5000);

      expect(limiter.tryAcquire('user-1')).toBe(true);
      // Should now be rate limited
      expect(limiter.isAllowed('user-1')).toBe(false);
    });

    it('should return false without recording when rate limited', () => {
      const limiter = createRateLimiter(5000);

      expect(limiter.tryAcquire('user-1')).toBe(true);

      // Advance time but not past cooldown
      vi.advanceTimersByTime(2000);

      // Try again - should fail
      expect(limiter.tryAcquire('user-1')).toBe(false);

      // Advance to just past the original cooldown (5000ms total)
      vi.advanceTimersByTime(3001);

      // Should now be allowed since the failed tryAcquire didn't reset the timer
      expect(limiter.isAllowed('user-1')).toBe(true);
    });

    it('should work correctly with different keys', () => {
      const limiter = createRateLimiter(5000);

      expect(limiter.tryAcquire('user-1')).toBe(true);
      expect(limiter.tryAcquire('user-2')).toBe(true);

      expect(limiter.tryAcquire('user-1')).toBe(false);
      expect(limiter.tryAcquire('user-2')).toBe(false);

      vi.advanceTimersByTime(5001);

      expect(limiter.tryAcquire('user-1')).toBe(true);
      expect(limiter.tryAcquire('user-2')).toBe(true);
    });
  });

  describe('different cooldown periods', () => {
    it('should respect custom cooldown periods', () => {
      const shortLimiter = createRateLimiter(1000);
      const longLimiter = createRateLimiter(10000);

      shortLimiter.record('key');
      longLimiter.record('key');

      vi.advanceTimersByTime(1001);

      expect(shortLimiter.isAllowed('key')).toBe(true);
      expect(longLimiter.isAllowed('key')).toBe(false);

      vi.advanceTimersByTime(9000);

      expect(longLimiter.isAllowed('key')).toBe(true);
    });
  });
});
