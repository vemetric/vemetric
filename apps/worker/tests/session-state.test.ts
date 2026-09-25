import { EMPTY_GEO_DATA } from '@vemetric/common/geo';
import { describe, expect, it } from 'vitest';
import { combineSession, type SessionState, type StoredSession } from '../src/ingestion/session-state';

const at = (minute: number) => `2026-09-05 12:0${minute}:00.000`;
const session = (minute: number, location: Partial<StoredSession> = {}): StoredSession => ({
  ...EMPTY_GEO_DATA,
  projectId: '1',
  userId: '2',
  id: 'session',
  startedAt: at(minute),
  endedAt: at(minute),
  duration: 0,
  pathname: `/entry-${minute}`,
  ...location,
});
const empty: SessionState = { revision: 0, latestAt: '' };
const update = (state: SessionState, incoming: StoredSession) => combineSession(state, incoming, incoming.endedAt);

describe('session timestamps', () => {
  it.each([
    ['', '000'],
    ['.1', '100'],
    ['.12', '120'],
    ['.123', '123'],
    ['.1234', '123'],
  ])('normalizes timestamps with fractional suffix "%s"', (suffix, milliseconds) => {
    const incoming = session(0, {
      startedAt: `2026-01-18 09:00:00${suffix}`,
      endedAt: `2026-01-18 09:01:00${suffix}`,
    });
    const result = update(empty, incoming);
    expect(result.latestAt).toBe(`2026-01-18 09:01:00.${milliseconds}`);
    expect(result.session).toMatchObject({
      startedAt: `2026-01-18 09:00:00.${milliseconds}`,
      endedAt: result.latestAt,
      duration: 60,
    });
    expect(incoming.startedAt).toBe(`2026-01-18 09:00:00${suffix}`);
  });

  it('treats equivalent precision as equal when selecting entry metadata', () => {
    const initial = update(empty, session(0));
    const next = update(initial, session(0, { startedAt: at(0).slice(0, 19), pathname: '/later' }));
    expect(next).toEqual(initial);
  });

  it('preserves the latest activity with mixed precision and out-of-order arrivals', () => {
    const pending = combineSession(empty, undefined, '2026-09-05 12:01:00.12');
    const created = update(pending, session(0, { startedAt: at(0).slice(0, 19), endedAt: at(0).slice(0, 19) }));
    const delayed = combineSession(created, undefined, '2026-09-05 12:01:00');
    expect(delayed.latestAt).toBe('2026-09-05 12:01:00.120');
    expect(delayed.session).toMatchObject({ startedAt: at(0), endedAt: delayed.latestAt, duration: 60 });
  });

  it.each([0, 60])('uses an explicitly supplied duration of %i for an imported session', (duration) => {
    const imported = session(0, { endedAt: at(5), duration });
    const created = combineSession(empty, imported, imported.endedAt, imported.duration);
    expect(created.session).toMatchObject({ endedAt: at(5), duration });
  });

  it.each(['2026-01-18 25:00:00', '2026-13-18 09:00:00', '2026-01-18 09:00:00.'])(
    'propagates date formatting errors for %s',
    (timestamp) => {
      expect(() => combineSession(empty, undefined, timestamp)).toThrow(RangeError);
      expect(() => update(empty, session(0, { startedAt: timestamp }))).toThrow(RangeError);
    },
  );
});

describe('session location', () => {
  it('keeps Vienna when a delayed earlier event supplies Graz', () => {
    const initial = update(empty, session(0));
    const vienna = update(initial, session(5, { city: 'Vienna', latitude: 48, longitude: 16 }));
    const delayed = update(vienna, session(3, { city: 'Graz', latitude: 47, longitude: 15 }));
    expect(delayed.session).toMatchObject({ city: 'Vienna', latitude: 48, longitude: 16, duration: 300 });
  });

  it('preserves location and the published start while correcting entry metadata from an earlier event', () => {
    const current = update(empty, session(5, { city: 'Vienna' }));
    const corrected = update(current, session(0, { city: 'Graz' }));
    expect(corrected.session).toMatchObject({ city: 'Vienna', pathname: '/entry-0', startedAt: at(5), duration: 0 });
  });

  it('fills missing fields without replacing known fields or zero coordinates', () => {
    const current = update(empty, session(0, { countryCode: '', city: 'Vienna', latitude: 0, longitude: null }));
    const filled = update(current, session(5, { countryCode: 'AT', city: '', latitude: 48, longitude: 16 }));
    expect(filled.session).toMatchObject({ countryCode: 'AT', city: 'Vienna', latitude: 0, longitude: 16 });
  });
});
