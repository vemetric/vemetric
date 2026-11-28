import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getEffectiveLastSeenExpression,
  getOnlineSessionsByUserQuery,
  isSessionOnline,
} from '../../src/models/session';

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

describe('getOnlineSessionsByUserQuery', () => {
  it('selects an explicit isOnline flag alongside latest endedAt per active user', () => {
    const query = getOnlineSessionsByUserQuery(BigInt(42));

    expect(query).toContain('SELECT userId, max(endedAt) as lastSessionEndedAt, toUInt8(1) as isOnline');
    expect(query).toContain('WHERE deleted = 0');
    expect(query).toContain('GROUP BY userId');
  });
});

describe('getEffectiveLastSeenExpression', () => {
  it('uses the newer of event and active session timestamps when open-ended', () => {
    expect(getEffectiveLastSeenExpression('u.maxEventCreatedAt')).toBe(
      'if(coalesce(s.isOnline, 0) = 1, greatest(u.maxEventCreatedAt, coalesce(s.lastSessionEndedAt, u.maxEventCreatedAt)), u.maxEventCreatedAt)',
    );
  });

  it('guards session timestamps against exceeding an explicit endDate', () => {
    expect(getEffectiveLastSeenExpression('u.maxEventCreatedAt', new Date('2026-07-21T12:00:00.000Z'))).toBe(
      "if(coalesce(s.isOnline, 0) = 1 AND coalesce(s.lastSessionEndedAt, u.maxEventCreatedAt) < '2026-07-21 12:00:00.000', greatest(u.maxEventCreatedAt, coalesce(s.lastSessionEndedAt, u.maxEventCreatedAt)), u.maxEventCreatedAt)",
    );
  });
});
