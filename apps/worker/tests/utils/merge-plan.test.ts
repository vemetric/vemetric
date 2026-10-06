import { describe, expect, it } from 'vitest';
import { planVisits, resolveSession, SESSION_GAP_MS, visitForTime } from '../../src/utils/merge-plan';

const minute = 60_000;
const session = (id: string, start: number, end: number, source = false) => ({
  id,
  source,
  startedAt: start * minute,
  endedAt: end * minute,
});

describe('planVisits', () => {
  it('joins sessions less than the session duration apart and keeps the earliest', () => {
    const { survivors, visits } = planVisits([
      session('phone', 60, 100),
      session('laptop', 0, 80, true),
      session('later', 129, 140),
    ]);
    expect(visits).toHaveLength(1);
    expect(Object.fromEntries(survivors)).toEqual({ laptop: 'laptop', phone: 'laptop', later: 'laptop' });
  });

  it('keeps sessions exactly the session duration apart separate', () => {
    expect(SESSION_GAP_MS).toBe(30 * minute);
    const { survivors } = planVisits([session('a', 0, 10, true), session('b', 40, 50)]);
    expect(Object.fromEntries(survivors)).toEqual({ a: 'a' });
  });

  it('leaves visits without a session of the merged id alone', () => {
    const { survivors, visits } = planVisits([
      session('t1', 0, 10),
      session('t2', 20, 30),
      session('s', 200, 210, true),
    ]);
    expect(visits).toHaveLength(2);
    expect(Object.fromEntries(survivors)).toEqual({ s: 's' });
  });

  it('breaks ties of equal starts by session id', () => {
    const { survivors } = planVisits([session('b', 0, 10), session('a', 0, 5, true)]);
    expect(survivors.get('b')).toBe('a');
  });
});

describe('visitForTime', () => {
  it('picks the closest visit within the session duration', () => {
    const { visits } = planVisits([session('a', 0, 10), session('b', 60, 70)]);
    expect(visitForTime(visits, 35 * minute)?.survivor).toBe('a');
    expect(visitForTime(visits, 45 * minute)?.survivor).toBe('b');
    expect(visitForTime(visits, 200 * minute)).toBeUndefined();
  });
});

describe('resolveSession', () => {
  it('follows later decisions and stops at cycles', () => {
    const decisions = new Map([
      ['t', 's1'],
      ['s1', 's0'],
      ['s0', 's0'],
    ]);
    expect(resolveSession(decisions, 't')).toBe('s0');
    expect(resolveSession(decisions, 'unknown')).toBe('unknown');
    expect(() =>
      resolveSession(
        new Map([
          ['a', 'b'],
          ['b', 'a'],
        ]),
        'a',
      ),
    ).toThrow('cycle');
  });
});
