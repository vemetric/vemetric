import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSessionOnline } from '../../src/models/session';

describe('isSessionOnline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('considers a session at the bucketed activity threshold online', () => {
    vi.setSystemTime(new Date('2026-07-21T12:00:00.000Z'));

    expect(isSessionOnline({ endedAt: '2026-07-21 11:55:30.000' })).toBe(true);
  });

  it('considers a session before the bucketed activity threshold offline', () => {
    vi.setSystemTime(new Date('2026-07-21T12:00:00.000Z'));

    expect(isSessionOnline({ endedAt: '2026-07-21 11:55:29.999' })).toBe(false);
  });

  it('keeps the threshold stable within the same 30-second interval', () => {
    vi.setSystemTime(new Date('2026-07-21T12:00:29.999Z'));

    expect(isSessionOnline({ endedAt: '2026-07-21 11:55:30.000' })).toBe(true);
  });

  it('considers a missing session offline', () => {
    expect(isSessionOnline(null)).toBe(false);
  });
});
