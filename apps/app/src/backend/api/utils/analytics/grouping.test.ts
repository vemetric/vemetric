import { describe, expect, it } from 'vitest';
import { listIntervalGroupKeys } from './grouping';

const date = (value: string) => new Date(value);

describe('listIntervalGroupKeys', () => {
  it('lists every hour from the one the period starts in to the one it ends in', () => {
    expect(listIntervalGroupKeys('hourly', date('2026-01-18T09:30:00Z'), date('2026-01-18T11:05:00Z'))).toEqual([
      '2026-01-18T09:00:00Z',
      '2026-01-18T10:00:00Z',
      '2026-01-18T11:00:00Z',
    ]);
  });

  it('lists every UTC day of a custom period', () => {
    expect(listIntervalGroupKeys('daily', date('2026-01-18T00:00:00Z'), date('2026-01-20T23:59:59Z'))).toEqual([
      '2026-01-18T00:00:00Z',
      '2026-01-19T00:00:00Z',
      '2026-01-20T00:00:00Z',
    ]);
  });

  it('starts weeks on Sunday, like ClickHouse', () => {
    // 2026-01-21 is a Wednesday
    expect(listIntervalGroupKeys('weekly', date('2026-01-21T08:00:00Z'), date('2026-02-01T10:00:00Z'))).toEqual([
      '2026-01-18T00:00:00Z',
      '2026-01-25T00:00:00Z',
      '2026-02-01T00:00:00Z',
    ]);
  });

  it('lists months across a year boundary', () => {
    expect(listIntervalGroupKeys('monthly', date('2025-11-15T00:00:00Z'), date('2026-01-31T23:59:59Z'))).toEqual([
      '2025-11-01T00:00:00Z',
      '2025-12-01T00:00:00Z',
      '2026-01-01T00:00:00Z',
    ]);
  });

  it('lists the 30-second and 10-minute intervals of the live and 1hr presets', () => {
    expect(listIntervalGroupKeys('thirty_seconds', date('2026-01-18T09:00:10Z'), date('2026-01-18T09:01:05Z'))).toEqual(
      ['2026-01-18T09:00:00Z', '2026-01-18T09:00:30Z', '2026-01-18T09:01:00Z'],
    );
    expect(listIntervalGroupKeys('ten_minutes', date('2026-01-18T09:05:00Z'), date('2026-01-18T09:25:00Z'))).toEqual([
      '2026-01-18T09:00:00Z',
      '2026-01-18T09:10:00Z',
      '2026-01-18T09:20:00Z',
    ]);
  });

  it('treats the end as exclusive, like the metric queries', () => {
    // The period ends exactly where February starts, so February isn't part of it.
    expect(listIntervalGroupKeys('monthly', date('2026-01-01T00:00:00Z'), date('2026-02-01T00:00:00Z'))).toEqual([
      '2026-01-01T00:00:00Z',
    ]);
  });

  it('lists nothing for an unknown interval', () => {
    expect(listIntervalGroupKeys('yearly', date('2026-01-18T00:00:00Z'), date('2026-01-19T00:00:00Z'))).toEqual([]);
  });
});
