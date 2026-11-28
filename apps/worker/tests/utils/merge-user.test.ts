import type { ClickhouseEvent, ClickhouseSession } from 'clickhouse';
import { describe, expect, it, vi } from 'vitest';
import { reassignExistingSessionsToEvents } from '../../src/utils/merge-user';

// An older session of the logged-in user, which ended 15 minutes before the anonymous visit.
const older = {
  id: 'older',
  startedAt: '2026-09-04 12:00:00.000',
  endedAt: '2026-09-04 12:05:00.000',
} as ClickhouseSession;
vi.mock('clickhouse', () => ({
  clickhouseSession: { findByUserId: vi.fn().mockResolvedValue([]) },
  clickhouseDateToISO: (date: string) => `${date.replace(' ', 'T')}Z`,
}));
vi.mock('../../src/ingestion', () => ({ getBufferedSessions: vi.fn(async () => [older]) }));

const visitEvents = ['2026-09-04 12:20:00.000', '2026-09-04 12:25:00.000'].map(
  (createdAt, index) => ({ id: `event-${index}`, sessionId: 'visit', createdAt }) as ClickhouseEvent,
);

describe('reassignExistingSessionsToEvents', () => {
  it('moves events within 30 minutes of an existing session of the new user into that session', async () => {
    const result = await reassignExistingSessionsToEvents({
      projectId: BigInt(1),
      newUserId: BigInt(2),
      existingEvents: visitEvents,
    });
    expect(result.sessionIdMapping).toEqual(new Map([['visit', 'older']]));
    expect(result.unmatchedSessionIds.size).toBe(0);
  });

  it.each([
    ['2026-09-04 12:35:00.000', true],
    ['2026-09-04 12:35:01.000', false],
  ])('treats an event at %s as within 30 minutes of the session end: %s', async (createdAt, matches) => {
    const result = await reassignExistingSessionsToEvents({
      projectId: BigInt(1),
      newUserId: BigInt(2),
      existingEvents: [{ id: 'event', sessionId: 'visit', createdAt } as ClickhouseEvent],
    });
    expect(result.sessionIdMapping).toEqual(matches ? new Map([['visit', 'older']]) : new Map());
    expect(result.unmatchedSessionIds).toEqual(matches ? new Set() : new Set(['visit']));
  });
});
