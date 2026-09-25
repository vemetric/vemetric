import { formatClickhouseDate } from '@vemetric/common/date';
import { describe, expect, it } from 'vitest';
import { currentSessionRows, sessionRows } from '../src/models/session';

describe('currentSessionRows', () => {
  it('resolves revisions and hides tombstoned sessions by default', () => {
    const rows = currentSessionRows(BigInt(7));
    expect(rows).toContain('FROM session_v3 FINAL');
    expect(rows).toContain("session_v3.projectId = '7'");
    expect(rows).toContain('AND deleted = 0');
    expect(rows).not.toContain('startedAt >=');
  });

  it('pushes the date range onto the qualified base column so partitions prune', () => {
    const startDate = new Date('2026-09-01T00:00:00.000Z');
    const endDate = new Date('2026-10-01T00:00:00.000Z');
    const rows = currentSessionRows(BigInt(7), { startDate, endDate });

    expect(rows).toContain(`session_v3.startedAt >= '${formatClickhouseDate(startDate)}'`);
    expect(rows).toContain(`session_v3.startedAt < '${formatClickhouseDate(endDate)}'`);
  });

  it('scopes explicit ids and renders an empty id list as a false predicate', () => {
    const rows = currentSessionRows(BigInt(7), { ids: ['a', 'b'] });
    expect(rows).toContain("session_v3.id IN ('a','b')");
    expect(rows).toContain('ORDER BY revision DESC LIMIT 1 BY id');
    expect(rows).not.toContain('FINAL');
    expect(currentSessionRows(BigInt(7), { ids: [] })).toContain('AND 0');
  });

  it('accepts a candidate-id subquery for per-user lookups', () => {
    const rows = currentSessionRows(BigInt(7), { ids: { subquery: 'SELECT id FROM session_v3' } });
    expect(rows).toContain('session_v3.id IN (SELECT id FROM session_v3)');
  });

  it('reads stored rows without FINAL for aggregates over distinct values', () => {
    const rows = sessionRows(BigInt(7), { startDate: new Date('2026-09-01T00:00:00.000Z') });
    expect(rows).toContain('FROM session_v3\n');
    expect(rows).not.toContain('FINAL');
    expect(rows).toContain("session_v3.startedAt >= '2026-09-01 00:00:00.000'");
    expect(rows).toContain('AND deleted = 0');
  });
});
