import { describe, expect, it } from 'vitest';
import { applyUserOp, MAX_PENDING_UPDATES, type UserOp, type UserState } from '../src/ingestion/user-state';

const ids = { projectId: '1', userId: '2' };
const at = (seconds: number) => `2026-10-05 10:00:${String(seconds).padStart(2, '0')}.000`;
const create = (seconds: number, data: Record<string, unknown> = {}): UserOp => ({
  type: 'create',
  create: {
    createdAt: at(seconds),
    identifier: 'alice',
    displayName: 'Alice',
    avatarUrl: '',
    data,
    geo: { countryCode: 'AT', city: 'Vienna', latitude: 48, longitude: 16 },
    firstPageView: { origin: 'https://example.com', pathname: '/landing', firstSeenAt: at(0) },
  },
});
const update = (seconds: number, change: Omit<Extract<UserOp, { type: 'update' }>['update'], 'updatedAt'>): UserOp => ({
  type: 'update',
  update: { updatedAt: at(seconds), ...change },
});

function run(ops: UserOp[], state: UserState = { revision: 0 }) {
  for (const op of ops) state = applyUserOp(state, op, ids)?.state ?? state;
  return state;
}

describe('applyUserOp', () => {
  it('creates the user like the previous create worker', () => {
    const { user } = run([create(1, { plan: 'free' })]);
    expect(user).toMatchObject({
      projectId: '1',
      id: '2',
      identifier: 'alice',
      displayName: 'Alice',
      createdAt: at(1),
      updatedAt: at(1),
      firstSeenAt: at(0),
      countryCode: 'AT',
      origin: 'https://example.com',
      customData: { plan: 'free' },
    });
  });

  it('applies set, setOnce and unset as before when jobs run in order', () => {
    const state = run([
      create(1, { plan: 'free', seats: 1 }),
      update(2, { data: { setOnce: { plan: 'trial', source: 'ads' }, set: { seats: 3 } } }),
      update(3, { displayName: 'Alice A.', data: { unset: ['source'], set: { plan: 'pro' } } }),
    ]);
    expect(state.user).toMatchObject({
      displayName: 'Alice A.',
      updatedAt: at(3),
      customData: { plan: 'pro', seats: 3 },
    });
  });

  it('keeps every change when updates run out of order', () => {
    const inOrder = run([
      create(1),
      update(5, { data: { set: { company: 'Acme' } } }),
      update(7, { data: { set: { plan: 'pro' } } }),
    ]);
    const reversed = run([
      create(1),
      update(7, { data: { set: { plan: 'pro' } } }),
      update(5, { data: { set: { company: 'Acme' } } }),
    ]);
    expect(reversed.user!.customData).toEqual(inOrder.user!.customData);
    expect(reversed.user!.customData).toEqual({ company: 'Acme', plan: 'pro' });
  });

  it('lets the newest value of a field win whatever the processing order', () => {
    const state = run([
      create(1),
      update(7, { displayName: 'New', data: { set: { plan: 'pro' } } }),
      update(5, { displayName: 'Old', data: { set: { plan: 'free' } } }),
    ]);
    expect(state.user).toMatchObject({ displayName: 'New', customData: { plan: 'pro' } });
  });

  it('does not let an older set bring back a key a newer unset removed', () => {
    const state = run([
      create(1, { plan: 'free' }),
      update(7, { data: { unset: ['plan'] } }),
      update(5, { data: { set: { plan: 'pro' } } }),
    ]);
    expect(state.user!.customData).toEqual({});
  });

  it('lets a set win over setOnce in either order, as before', () => {
    const setFirst = run([
      create(1),
      update(5, { data: { set: { plan: 'pro' } } }),
      update(7, { data: { setOnce: { plan: 'free' } } }),
    ]);
    const setOnceFirst = run([
      create(1),
      update(7, { data: { setOnce: { plan: 'free' } } }),
      update(5, { data: { set: { plan: 'pro' } } }),
    ]);
    expect(setFirst.user!.customData).toEqual({ plan: 'pro' });
    expect(setOnceFirst.user!.customData).toEqual({ plan: 'pro' });
  });

  it('keeps updates that arrive before the user exists and applies them on create', () => {
    const waiting = run([update(5, { data: { set: { company: 'Acme' } } })]);
    expect(waiting.user).toBeUndefined();
    expect(waiting.pending).toHaveLength(1);
    const state = run([create(1, { plan: 'free' })], waiting);
    expect(state.user!.customData).toEqual({ plan: 'free', company: 'Acme' });
    expect(state.user!.updatedAt).toBe(at(5));
    expect(state.pending).toBeUndefined();
  });

  it('bounds the updates waiting for a create', () => {
    const ops = Array.from({ length: MAX_PENDING_UPDATES + 5 }, (_, i) =>
      update(1, { data: { set: { [`k${i}`]: i } } }),
    );
    expect(run(ops).pending).toHaveLength(MAX_PENDING_UPDATES);
  });

  it('turns a create of an existing user into a set of its data, as before', () => {
    const state = run([create(1, { plan: 'free' }), { ...create(9, { plan: 'pro' }) }]);
    expect(state.user).toMatchObject({
      identifier: 'alice',
      createdAt: at(1),
      updatedAt: at(9),
      customData: { plan: 'pro' },
    });
  });

  it('reports no change for an update that changes nothing', () => {
    const state = run([create(1, { plan: 'free' })]);
    expect(applyUserOp(state, update(1, { data: { set: { plan: 'free' } } }), ids)).toBeNull();
  });

  it('writes a newer updatedAt for every change, even with an older or equal timestamp', () => {
    const state = run([create(1), update(1, { data: { set: { plan: 'pro' } } })]);
    expect(state.user!.updatedAt).toBe('2026-10-05 10:00:01.001');
    const older = applyUserOp(state, update(0, { data: { set: { seats: 2 } } }), ids)!;
    expect(older.dirty).toBe(true);
    expect(older.state.user!.updatedAt).toBe('2026-10-05 10:00:01.002');
  });

  it('enriches only a user without attribution data', () => {
    const enrich = (origin: string): UserOp => ({
      type: 'enrich',
      at: at(9),
      firstPageView: { origin, pathname: '/x', initialDeviceId: BigInt('18446744073709551615') },
    });
    const withoutAttribution = create(1) as Extract<UserOp, { type: 'create' }>;
    const created = run([{ type: 'create', create: { ...withoutAttribution.create, firstPageView: {} } }]);
    const enriched = run([enrich('https://a.example')], created);
    expect(enriched.user).toMatchObject({
      origin: 'https://a.example',
      initialDeviceId: '18446744073709551615',
      updatedAt: at(9),
    });
    expect(applyUserOp(enriched, enrich('https://b.example'), ids)).toBeNull();
    expect(applyUserOp({ revision: 0 }, enrich('https://b.example'), ids)).toBeNull();
  });

  describe('attribution of a first login', () => {
    const landing: UserOp = {
      type: 'attribute',
      at: at(30),
      firstPageView: { origin: 'https://example.com', pathname: '/landing', referrer: 'Google', firstSeenAt: at(0) },
    };
    const dashboard = { origin: 'https://example.com', pathname: '/dashboard', referrer: '', firstSeenAt: at(20) };

    it('replaces attribution from a later page view with the earlier merged one', () => {
      const created = run([{ type: 'create', create: { ...(create(10) as any).create, firstPageView: dashboard } }]);
      expect(run([landing], created).user).toMatchObject({
        pathname: '/landing',
        referrer: 'Google',
        firstSeenAt: at(0),
      });
    });

    it('keeps attribution that is already earlier', () => {
      const created = run([{ type: 'create', create: { ...(create(10) as any).create, firstPageView: dashboard } }]);
      const later: UserOp = { ...landing, firstPageView: { ...landing.firstPageView, firstSeenAt: at(25) } };
      expect(applyUserOp(created, later, ids)).toBeNull();
    });

    it('applies a merged first page view that arrived before the create', () => {
      const waiting = run([landing]);
      expect(waiting.user).toBeUndefined();
      const state = run(
        [{ type: 'create', create: { ...(create(10) as any).create, firstPageView: dashboard } }],
        waiting,
      );
      expect(state.user).toMatchObject({ pathname: '/landing', firstSeenAt: at(0) });
      expect(state.pendingFirstPageView).toBeUndefined();
    });
  });
});
