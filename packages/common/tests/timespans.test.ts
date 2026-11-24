import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTimeSpanRangeMax } from '../src/charts/timespans';

describe('getTimeSpanRangeMax', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the current clock on every call', () => {
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    expect(getTimeSpanRangeMax()).toEqual(new Date(2026, 4, 31));

    vi.setSystemTime(new Date('2026-06-17T12:00:00Z'));
    expect(getTimeSpanRangeMax()).toEqual(new Date(2026, 5, 30));
  });
});
