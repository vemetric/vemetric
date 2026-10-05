import { mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickhouseClient } from '../../../packages/clickhouse/src/client';
import { clickhouseDevice } from '../../../packages/clickhouse/src/models/device';
import { clickhouseEvent, EXAMPLE_EVENT, type ClickhouseEvent } from '../../../packages/clickhouse/src/models/event';
import { clickhouseSession, type ClickhouseSession } from '../../../packages/clickhouse/src/models/session';
import { clickhouseUser } from '../../../packages/clickhouse/src/models/user';
import { getDeviceId } from '../../../packages/clickhouse/src/utils/id';
import {
  continueMergedSession,
  loadMergeRecord,
  mergeRecordKey,
  needsFollowUp,
  saveMergeRecord,
} from '../src/ingestion/merge-record';
import { closeStateRedis, stateRedis } from '../src/ingestion/redis';
import { bufferSessionUpdate } from '../src/ingestion/session-buffer';
import { flushSessionBuffer } from '../src/ingestion/session-flush';
import { flushUserBuffer, getUser, upsertUser } from '../src/ingestion/user-buffer';
import { insertDeviceIfNotExists } from '../src/utils/device';
import { followUpIfMerged } from '../src/utils/merge-follow-up';
import { reconcileUser } from '../src/utils/merge-user';
import { getUserFirstPageViewData } from '../src/utils/user';

const projectId = BigInt('18446744073709551000');
const anonymous = BigInt('18446744073709551010');
const alice = BigInt('18446744073709551011');
// Minutes after 09:00 on 2026-09-04.
const at = (minutes: number) =>
  new Date(Date.UTC(2026, 8, 4, 9, 0, 0) + minutes * 60_000).toISOString().replace('T', ' ').replace('Z', '');
const hubKey = (userId: bigint) => `sessionid:${projectId}:${userId}`;

const device = {
  osName: 'macOS',
  osVersion: '15',
  clientName: 'Chrome',
  clientVersion: '140',
  clientType: 'browser' as const,
  deviceType: 'desktop' as const,
};

function event(userId: bigint, sessionId: string, minutes: number, pathname: string): ClickhouseEvent {
  return {
    ...EXAMPLE_EVENT,
    ...device,
    projectId,
    userId,
    sessionId,
    deviceId: getDeviceId(projectId, userId, device),
    id: `${sessionId}-${pathname}-${minutes}`,
    name: '$$pageView',
    isPageView: true,
    createdAt: at(minutes),
    pathname,
    origin: 'https://example.com',
    countryCode: 'AT',
    latitude: null,
    longitude: null,
    userIdentifier: '',
    userDisplayName: '',
  };
}

async function session(userId: bigint, id: string, start: number, end: number, pathname: string, referrer = '') {
  const value: ClickhouseSession = {
    projectId,
    userId,
    id,
    startedAt: at(start),
    endedAt: at(start),
    duration: 0,
    countryCode: 'AT',
    city: 'Vienna',
    latitude: 48,
    longitude: 16,
    origin: 'https://example.com',
    pathname,
    referrer,
  };
  await bufferSessionUpdate(projectId, id, at(start), value);
  await bufferSessionUpdate(projectId, id, at(end));
}

async function visit(userId: bigint, id: string, pages: Array<[number, string]>, referrer = '') {
  await session(userId, id, pages[0]![0], pages[pages.length - 1]![0], pages[0]![1], referrer);
  const events = pages.map(([minutes, pathname]) => event(userId, id, minutes, pathname));
  await clickhouseEvent.insert(events);
  await insertDeviceIfNotExists(projectId, userId, events[0]!.deviceId, device);
  return events;
}

async function merge(cutoffMinutes: number) {
  await saveMergeRecord(projectId, anonymous, {
    merges: [
      {
        target: String(alice),
        cutoff: at(cutoffMinutes),
        identifier: 'alice',
        displayName: 'Alice',
      },
    ],
  });
  return reconcileUser(projectId, anonymous);
}

// Grouped per session too: an event moved to another session of the same user keeps its cancelled
// row in the old session until ClickHouse collapses them (as the user detail page reads them).
const eventsOf = async (userId: bigint) => {
  const result = await clickhouseClient.query({
    query: `SELECT id, any(pathname) AS pathname, sessionId, any(createdAt) AS createdAt,
        any(userIdentifier) AS userIdentifier, any(userDisplayName) AS userDisplayName
      FROM event WHERE projectId = ${projectId} AND userId = ${userId}
      GROUP BY id, sessionId HAVING sum(sign) > 0 ORDER BY createdAt`,
    format: 'JSONEachRow',
  });
  return result.json<
    Pick<ClickhouseEvent, 'id' | 'pathname' | 'sessionId' | 'createdAt' | 'userIdentifier' | 'userDisplayName'>
  >();
};
const sessionsOf = async (userId: bigint) => {
  await flushSessionBuffer();
  return (await clickhouseSession.findByUserId(projectId, userId)).sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
};
// Every event id is live exactly once across both users, whatever ClickHouse merged so far.
async function liveRowsPerEvent() {
  const result = await clickhouseClient.query({
    query: `SELECT id, sum(sign) AS live FROM event WHERE projectId = ${projectId} GROUP BY id`,
    format: 'JSONEachRow',
  });
  return (await result.json<{ id: string; live: string | number }>()).map((row) => Number(row.live));
}

describe.skipIf(process.env.INGESTION_STATE_TESTS !== '1')('user merges against Redis and ClickHouse', () => {
  beforeAll(() => {
    if (
      !process.env.CLICKHOUSE_DB?.startsWith('vm_concurrency_test_') ||
      new URL(process.env.REDIS_URL!).port !== '16389'
    ) {
      throw new Error('Use an isolated vm_concurrency_test_* database and Redis on port 16389');
    }
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await stateRedis().flushdb();
    for (const table of ['event', 'session_v3', 'device_v2', 'user'])
      await clickhouseClient.command({ query: `TRUNCATE TABLE ${table}` });
    await upsertUser(projectId, alice, {
      type: 'create',
      create: {
        createdAt: at(-600),
        identifier: 'alice',
        displayName: 'Alice',
        avatarUrl: '',
        data: {},
        firstPageView: {},
      },
    });
  });
  afterAll(async () => {
    await closeStateRedis();
    await clickhouseClient.close();
  });

  it("attributes a user created at the login to the visitor's landing page", async () => {
    // The first page view after the login was stored before the user was created.
    await visit(alice, 'POST', [[12, '/dashboard']]);
    await upsertUser(projectId, alice, {
      type: 'create',
      create: {
        createdAt: at(11),
        identifier: 'alice',
        displayName: 'Alice',
        avatarUrl: '',
        data: {},
        firstPageView: getUserFirstPageViewData((await clickhouseEvent.getFirstPageViewByUserId(projectId, alice))!),
      },
    });
    await visit(anonymous, 'S', [
      [0, '/landing'],
      [5, '/pricing'],
    ]);
    await merge(11);

    await flushUserBuffer();
    expect(await clickhouseUser.findById(projectId, alice)).toMatchObject({ pathname: '/landing', firstSeenAt: at(0) });
  });

  it('moves the attribution of an existing user to an earlier merged visit only', async () => {
    await visit(alice, 'OLD', [[-500, '/pricing']]);
    await upsertUser(projectId, alice, {
      type: 'enrich',
      at: at(-400),
      firstPageView: getUserFirstPageViewData((await clickhouseEvent.getFirstPageViewByUserId(projectId, alice))!),
    });
    // A later visit on another device leaves it as it is.
    await visit(anonymous, 'LATER', [[-100, '/blog']]);
    await merge(-90);
    await flushUserBuffer();
    expect(await clickhouseUser.findById(projectId, alice)).toMatchObject({
      pathname: '/pricing',
      firstSeenAt: at(-500),
    });

    // Anonymous history from before the user's first page view becomes its first touch.
    await stateRedis().del(mergeRecordKey(projectId, anonymous));
    await visit(anonymous, 'EARLIER', [[-600, '/landing']]);
    await merge(0);
    await flushUserBuffer();
    expect(await clickhouseUser.findById(projectId, alice)).toMatchObject({
      pathname: '/landing',
      firstSeenAt: at(-600),
    });
  });

  it('queues a follow-up for an event stored after the merge read the merged id', async () => {
    await visit(anonymous, 'S', [[0, '/landing']]);
    await merge(10);
    const late = event(anonymous, 'S', 6, '/late');
    await clickhouseEvent.insert([late]);
    await followUpIfMerged(projectId, anonymous, late);
    expect(await mergeUserQueue.getDelayedCount()).toBe(1);
    await mergeUserQueue.obliterate({ force: true });
  });

  it('moves an anonymous visit to the identified user with its entry data', async () => {
    await visit(
      anonymous,
      'S',
      [
        [0, '/landing'],
        [5, '/pricing'],
        [9, '/login'],
      ],
      'Google',
    );
    await merge(10);

    expect(await eventsOf(anonymous)).toHaveLength(0);
    const events = await eventsOf(alice);
    expect(events.map((e) => [e.pathname, e.sessionId, e.userIdentifier, e.userDisplayName])).toEqual([
      ['/landing', 'S', 'alice', 'Alice'],
      ['/pricing', 'S', 'alice', 'Alice'],
      ['/login', 'S', 'alice', 'Alice'],
    ]);
    expect(await sessionsOf(alice)).toMatchObject([
      { id: 'S', pathname: '/landing', referrer: 'Google', userIdentifier: 'alice' },
    ]);
    expect(await clickhouseDevice.findByUserId(projectId, anonymous)).toHaveLength(0);
    expect(await clickhouseDevice.findByUserId(projectId, alice)).toHaveLength(1);
    expect(await liveRowsPerEvent()).toEqual([1, 1, 1]);
    // Attribution of the identified user now comes from the merged first page view.
    await flushUserBuffer();
    expect(await clickhouseUser.findById(projectId, alice)).toMatchObject({ pathname: '/landing', firstSeenAt: at(0) });
  });

  it('makes one session of visits less than 30 minutes apart, kept by the earliest one', async () => {
    // Alice on her phone from 10:00 to 10:40, anonymous on her laptop since 09:00.
    await visit(alice, 'T', [
      [60, '/dashboard'],
      [75, '/reports'],
      [100, '/settings'],
    ]);
    await stateRedis().set(hubKey(alice), 'T', 'EX', 1800);
    await visit(
      anonymous,
      'S',
      [
        [0, '/landing'],
        [10, '/features'],
        [20, '/pricing'],
        [35, '/docs'],
        [50, '/docs/api'],
        [80, '/blog'],
      ],
      'Google',
    );
    await merge(105);
    await reconcileUser(projectId, alice);

    const sessions = await sessionsOf(alice);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'S',
      startedAt: at(0),
      endedAt: at(100),
      pathname: '/landing',
      referrer: 'Google',
    });
    expect(new Set((await eventsOf(alice)).map((e) => e.sessionId))).toEqual(new Set(['S']));
    expect(await eventsOf(alice)).toHaveLength(9);
    // The phone continues the visit.
    expect(await stateRedis().get(hubKey(alice))).toBe('S');
    expect(await liveRowsPerEvent()).toEqual(Array(9).fill(1));
  });

  it("moves the user's own events of a continued session that is merged into an earlier one", async () => {
    await visit(alice, 'T', [
      [0, '/dashboard'],
      [10, '/reports'],
    ]);
    // The visitor logs in at minute 25 and Alice continues the visitor's session.
    await visit(anonymous, 'E', [
      [20, '/landing'],
      [24, '/login'],
    ]);
    await clickhouseEvent.insert([event(alice, 'E', 26, '/account')]);
    await stateRedis().set(hubKey(alice), 'E', 'EX', 1800);
    await merge(25);

    expect((await eventsOf(alice)).map((e) => [e.pathname, e.sessionId])).toEqual([
      ['/dashboard', 'T'],
      ['/reports', 'T'],
      ['/landing', 'T'],
      ['/login', 'T'],
      ['/account', 'T'],
    ]);
    expect((await sessionsOf(alice)).map((s) => s.id)).toEqual(['T']);
    expect(await stateRedis().get(hubKey(alice))).toBe('T');
  });

  it('keeps visits that are 30 minutes or more apart separate', async () => {
    await visit(alice, 'T', [[100, '/dashboard']]);
    await visit(anonymous, 'S', [
      [0, '/landing'],
      [10, '/pricing'],
    ]);
    await merge(105);

    expect((await sessionsOf(alice)).map((s) => s.id)).toEqual(['S', 'T']);
  });

  it('leaves activity after the cutoff with the anonymous id unless its session moved', async () => {
    await visit(anonymous, 'S', [
      [0, '/landing'],
      [5, '/login'],
      [8, '/other-tab'],
    ]);
    await visit(anonymous, 'LATER', [[120, '/blog']]);
    await merge(6);

    expect((await eventsOf(alice)).map((e) => e.pathname)).toEqual(['/landing', '/login', '/other-tab']);
    expect((await eventsOf(anonymous)).map((e) => e.pathname)).toEqual(['/blog']);
    expect((await sessionsOf(anonymous)).map((s) => s.id)).toEqual(['LATER']);
    expect(await clickhouseDevice.findByUserId(projectId, anonymous)).toHaveLength(1);
  });

  it('finishes a merge that failed halfway without losing or duplicating events', async () => {
    await visit(alice, 'T', [[30, '/dashboard']]);
    await visit(anonymous, 'S', [
      [0, '/landing'],
      [5, '/pricing'],
      [9, '/login'],
    ]);
    const move = clickhouseEvent.moveEvents;
    const failing = vi.spyOn(clickhouseEvent, 'moveEvents').mockRejectedValueOnce(new Error('timeout'));
    await expect(merge(10)).rejects.toThrow('timeout');
    expect(await eventsOf(anonymous)).toHaveLength(3);

    failing.mockImplementation(move);
    await reconcileUser(projectId, anonymous);
    await reconcileUser(projectId, alice);
    await reconcileUser(projectId, anonymous);

    expect(await eventsOf(anonymous)).toHaveLength(0);
    expect((await eventsOf(alice)).map((e) => e.sessionId)).toEqual(['S', 'S', 'S', 'S']);
    expect((await sessionsOf(alice)).map((s) => s.id)).toEqual(['S']);
    expect(await liveRowsPerEvent()).toEqual([1, 1, 1, 1]);
  });

  it('moves events and sessions stored after the merge with a follow-up', async () => {
    await visit(alice, 'T', [[40, '/dashboard']]);
    await visit(anonymous, 'S', [
      [0, '/landing'],
      [5, '/login'],
    ]);
    await merge(10);

    // A late event of the merged visit, and a session whose creating job was late.
    const late = event(anonymous, 'S', 6, '/late');
    await clickhouseEvent.insert([late]);
    expect(needsFollowUp(await loadMergeRecord(projectId, anonymous), anonymous, late)).toBe(true);
    await visit(anonymous, 'LATE-SESSION', [[8, '/second-tab']]);
    await reconcileUser(projectId, anonymous);

    expect(await eventsOf(anonymous)).toHaveLength(0);
    expect((await eventsOf(alice)).map((e) => [e.pathname, e.sessionId])).toEqual([
      ['/landing', 'S'],
      ['/login', 'S'],
      ['/late', 'S'],
      ['/second-tab', 'S'],
      // Alice's phone session started more than 30 minutes after the laptop visit.
      ['/dashboard', 'T'],
    ]);
    expect((await sessionsOf(alice)).map((s) => s.id)).toEqual(['S', 'T']);
    // Activity after the cutoff in a new session needs no follow-up.
    expect(
      needsFollowUp(await loadMergeRecord(projectId, anonymous), anonymous, event(anonymous, 'NEW', 200, '/x')),
    ).toBe(false);
  });

  it('extends the session that kept the visit when a merged-away session gets late activity', async () => {
    await visit(alice, 'T', [[20, '/dashboard']]);
    await visit(anonymous, 'S', [[0, '/landing']]);
    await merge(25);
    await reconcileUser(projectId, alice);

    expect(await bufferSessionUpdate(projectId, 'T', at(45))).toBe('deleted');
    await continueMergedSession(projectId, alice, 'T', at(45));
    expect(await sessionsOf(alice)).toMatchObject([{ id: 'S', endedAt: at(45) }]);
  });

  it('puts events of sessions that never existed into the visit they fall into', async () => {
    await visit(alice, 'T', [[20, '/dashboard']]);
    await clickhouseEvent.insert([event(anonymous, 'GONE', 10, '/historical'), event(anonymous, 'FAR', -300, '/old')]);
    await merge(25);

    expect((await eventsOf(alice)).map((e) => [e.pathname, e.sessionId])).toEqual([
      ['/old', 'FAR'],
      ['/historical', 'T'],
      ['/dashboard', 'T'],
    ]);
    expect((await getUser(projectId, alice))?.identifier).toBe('alice');
  });
});
