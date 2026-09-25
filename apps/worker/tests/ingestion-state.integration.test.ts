import { formatClickhouseDate } from '@vemetric/common/date';
import { sessionQueueName } from '@vemetric/queues/queue-names';
import type { SessionQueueProps } from '@vemetric/queues/session-queue';
import { Queue, QueueEvents } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickhouseClient, clickhouseInsert } from '../../../packages/clickhouse/src/client';
import { clickhouseDevice } from '../../../packages/clickhouse/src/models/device';
import { clickhouseEvent } from '../../../packages/clickhouse/src/models/event';
import {
  clickhouseSession,
  currentSessionRows,
  type ClickhouseSession,
} from '../../../packages/clickhouse/src/models/session';
import { clickhouseUser } from '../../../packages/clickhouse/src/models/user';
import { getUserFilterQueries } from '../../../packages/clickhouse/src/utils/filters';
import { CONTINUE_SESSION, GET_OR_CREATE_SESSION, REFRESH_SESSION } from '../../hub/src/utils/session';
import { closeStateRedis, stateRedis } from '../src/ingestion/redis';
import {
  bufferExistingSessionActivity,
  bufferSessionUpdate,
  getBufferedSessions,
  findPendingSession,
  reassignBufferedSession,
  deleteBufferedSession,
} from '../src/ingestion/session-buffer';
import { flushSessionBuffer, pendingSessionStats, persistSessionUpdates } from '../src/ingestion/session-flush';
import { sessionKey, sessionStore } from '../src/ingestion/session-store';
import { insertDeviceIfNotExists } from '../src/utils/device';
import { findIngestionUser, invalidateIngestionUser } from '../src/utils/user-cache';
import { initSessionWorker } from '../src/workers/session-worker';

const projectId = BigInt('18446744073709551000');
const userId = BigInt('18446744073709551001');
const at = (seconds: number) =>
  new Date(Date.UTC(2026, 8, 4, 12, 0, seconds)).toISOString().replace('T', ' ').replace('Z', '');
const session = (id: string, seconds: number): ClickhouseSession => ({
  projectId,
  userId,
  id,
  startedAt: at(seconds),
  endedAt: at(seconds),
  duration: 0,
  countryCode: 'AT',
  city: 'Vienna',
  latitude: 48,
  longitude: 16,
  origin: 'https://example.com',
  pathname: `/entry-${seconds}`,
});

describe.skipIf(process.env.INGESTION_STATE_TESTS !== '1')('concurrent ingestion against Redis and ClickHouse', () => {
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
    for (const table of ['session_v3', 'device_v2', 'user'])
      await clickhouseClient.command({ query: `TRUNCATE TABLE ${table}` });
  });
  afterAll(async () => {
    await closeStateRedis();
    await clickhouseClient.close();
  });

  it('accepts second-precision session inserts and compares normalized timestamps after hydration', async () => {
    const initial = {
      ...session('seconds', 0),
      startedAt: at(0).slice(0, 19),
      endedAt: at(30).slice(0, 19),
    };
    await persistSessionUpdates([initial]);
    expect(await clickhouseSession.findById(projectId, userId, initial.id)).toMatchObject({
      startedAt: at(0),
      endedAt: at(30),
      duration: 30,
    });
    await stateRedis().del(`vm:{session-state}:${projectId}:${initial.id}`);
    // The same instant with fewer fractional digits must not replace entry metadata.
    await persistSessionUpdates([{ ...initial, endedAt: at(60).slice(0, 19), pathname: '/later' }]);
    expect(await bufferExistingSessionActivity(projectId, initial.id, initial.startedAt)).toBe('buffered');
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, initial.id)).toMatchObject({
      startedAt: at(0),
      endedAt: at(60),
      duration: 60,
      pathname: initial.pathname,
    });
  });

  it('preserves a supplied duration on insert', async () => {
    const initial = { ...session('measured-duration', 0), endedAt: at(300), duration: 60 };
    await persistSessionUpdates([initial], { preserveDuration: true });
    expect(await clickhouseSession.findById(projectId, userId, initial.id)).toMatchObject({ duration: 60 });
  });

  it('preserves the existing session defaults and the default deletion marker', async () => {
    await clickhouseClient.insert({
      table: 'session_v3',
      format: 'JSONEachRow',
      values: [
        {
          projectId: String(projectId),
          userId: String(userId),
          id: 'defaults',
          startedAt: at(0),
          endedAt: at(0),
          referrer: 'example.com',
        },
      ],
    });
    const result = await clickhouseClient.query({
      query:
        "SELECT referrerUrl, referrerType, queryParams, deleted, toTypeName(deleted) AS deletedType FROM session_v3 WHERE id = 'defaults'",
      format: 'JSONEachRow',
    });
    expect(await result.json()).toEqual([
      { referrerUrl: 'example.com', referrerType: 'unknown', queryParams: '', deleted: 0, deletedType: 'Int8' },
    ]);
  });

  it('selects ownership and nullable values by revision even when activity time is unchanged', async () => {
    const newUser = userId + BigInt(1);
    await clickhouseInsert({
      table: 'session_v3',
      values: [
        { ...session('reassigned', 0), revision: '1', userIdentifier: 'old', userDisplayName: 'Old', latitude: 48 },
        {
          ...session('reassigned', 0),
          revision: '2',
          userId: newUser,
          userIdentifier: null,
          userDisplayName: null,
          latitude: null,
          longitude: 0,
        },
        { ...session('reassigned', 0), projectId: projectId - BigInt(1), revision: '99' },
      ],
    });
    expect(await clickhouseSession.findById(projectId, userId, 'reassigned')).toBeNull();
    expect(await clickhouseSession.findByUserId(projectId, userId)).toEqual([]);
    expect(await clickhouseSession.findByIds(projectId, userId, new Set(['reassigned']))).toEqual([]);
    expect(await clickhouseSession.findByIds(projectId, newUser, new Set())).toEqual([]);
    expect(await clickhouseSession.findLatestByUserId(projectId, newUser)).toMatchObject({
      userId: newUser,
      userIdentifier: null,
      userDisplayName: null,
      latitude: null,
      longitude: 0,
    });
    // Cache hydration uses the highest revision, including nullable fields, without FINAL.
    await bufferSessionUpdate(projectId, 'reassigned', at(10));
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, newUser, 'reassigned')).toMatchObject({
      userId: newUser,
      duration: 10,
      latitude: null,
      longitude: 0,
    });
  });

  it('resolves revisions before date and deletion filters in dashboard queries', async () => {
    const initial = {
      ...session('entry-corrected', -30),
      endedAt: at(30),
      duration: 60,
      revision: '1',
      referrer: 'old.example',
    };
    await clickhouseInsert({
      table: 'session_v3',
      values: [
        initial,
        // Revisions share the immutable start; only the other fields change.
        { ...initial, revision: '2', referrer: 'new.example' },
        { ...session('deleted-row', 0), revision: '1', duration: 100 },
        { ...session('deleted-row', 0), revision: '2', deleted: 1 },
        { ...session('live', 0), revision: '1', endedAt: at(30), duration: 30, referrer: 'live.example' },
      ],
    });
    const options = {
      startDate: new Date(at(0).replace(' ', 'T') + 'Z'),
      endDate: new Date(at(60).replace(' ', 'T') + 'Z'),
      filterQueries: '',
      filterConfig: undefined,
    };
    expect(
      await clickhouseSession.queryApiVisitDurationRows({ projectId, ...options, grouping: { kind: 'none' } }),
    ).toEqual([{ groupKey: '__all__', value: 30 }]);
    expect(
      await clickhouseSession.getVisitDurationTimeSeries(projectId, { ...options, timeSpan: '1hr' }),
    ).toMatchObject([{ count: 30, sessionCount: 1 }]);
    const filterable = await clickhouseEvent.getFilterableData(projectId, options.startDate, options.endDate);
    expect(filterable.sources.referrers).toEqual(['live.example']);
    expect(await clickhouseSession.getCountryCodes(projectId, options)).toEqual([{ countryCode: 'AT', users: 1 }]);
    expect(await clickhouseSession.getCities(projectId, options)).toEqual([
      { city: 'Vienna', countryCode: 'AT', users: 1 },
    ]);
    const sources = await clickhouseSession.getTopSources(projectId, 'referrer', options);
    expect(sources.map((source) => source.referrer)).toEqual(['live.example']);
    expect(await clickhouseSession.findById(projectId, userId, 'deleted-row')).toBeNull();
  });

  it('filters users by the current session location and referrer rather than old revisions', async () => {
    await clickhouseInsert({
      table: 'session_v3',
      values: [
        { ...session('filters', 0), revision: '1', referrer: 'old.example' },
        { ...session('filters', 0), revision: '2', city: 'Berlin', referrer: 'new.example' },
      ],
    });
    for (const city of ['Vienna', 'Berlin']) {
      const { filterQueries } = getUserFilterQueries({
        projectId,
        filterConfig: {
          operator: 'and',
          filters: [{ type: 'location', cityFilter: { operator: 'oneOf', value: [city] } }],
        },
      });
      const result = await clickhouseClient.query({
        query: `SELECT id FROM ${currentSessionRows(projectId)} WHERE 1 ${filterQueries}`,
        format: 'JSONEachRow',
      });
      expect(await result.json()).toEqual(city === 'Berlin' ? [{ id: 'filters' }] : []);
    }
    const { filterQueries } = getUserFilterQueries({
      projectId,
      filterConfig: {
        operator: 'and',
        filters: [{ type: 'referrer', referrerFilter: { operator: 'is', value: 'old.example' } }],
      },
    });
    const result = await clickhouseClient.query({
      query: `SELECT id FROM ${currentSessionRows(projectId)} WHERE 1 ${filterQueries}`,
      format: 'JSONEachRow',
    });
    expect(await result.json()).toEqual([]);
  });

  it('resolves device revisions before joining users, including earliest creation and tombstones', async () => {
    const device = {
      projectId,
      userId,
      id: BigInt(345),
      createdAt: at(10),
      osName: 'Linux',
      osVersion: '1',
      clientName: 'Later',
      clientVersion: '1',
      clientType: 'browser' as const,
      deviceType: 'desktop' as const,
    };
    await clickhouseDevice.insert([device, { ...device, createdAt: at(0), clientName: 'Earlier' }]);
    await clickhouseInsert({
      table: 'user',
      values: [
        {
          projectId,
          id: userId,
          identifier: 'device-join',
          initialDeviceId: device.id,
          createdAt: at(0),
          updatedAt: at(0),
        },
      ],
    });
    expect(await clickhouseUser.findById(projectId, userId, true)).toMatchObject({ device: { clientName: 'Earlier' } });
    await clickhouseDevice.delete([device]);
    expect(await clickhouseDevice.findByUserId(projectId, userId)).toEqual([]);
    const user = await clickhouseUser.findById(projectId, userId, true);
    expect(user?.device?.clientName ?? '').toBe('');
  });

  it('assigns one session across concurrent hub requests and never revives an expired session', async () => {
    const redis = stateRedis();
    const results = (await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        redis.eval(GET_OR_CREATE_SESSION, 1, 'test-session', `candidate-${i}`, 1800),
      ),
    )) as Array<[string, number]>;
    const ids = results.map(([id]) => id);
    expect(new Set(ids).size).toBe(1);
    // Exactly one request reports the session as newly created.
    expect(results.filter(([, created]) => created === 1)).toHaveLength(1);
    await redis.set('test-session', 'replacement');
    expect(await redis.eval(REFRESH_SESSION, 1, 'test-session', ids[0] as string, 1800)).toBe(0);
    expect(await redis.get('test-session')).toBe('replacement');
    await redis.del('test-session');
    expect(await redis.eval(REFRESH_SESSION, 1, 'test-session', ids[0] as string, 1800)).toBe(0);
    expect(await redis.exists('test-session')).toBe(0);
  });

  it('hands an anonymous session to the logged-in user only if that user has no active session', async () => {
    const redis = stateRedis();
    expect(await redis.eval(CONTINUE_SESSION, 2, 'anonymous', 'identified', 1800)).toBeNull();
    await redis.set('anonymous', 'visit');
    expect(await redis.eval(CONTINUE_SESSION, 2, 'anonymous', 'identified', 1800)).toBe('visit');
    expect(await redis.get('identified')).toBe('visit');
    expect(await redis.ttl('identified')).toBeGreaterThan(1700);
    // An active session of the user (e.g. on another device) is kept.
    await redis.set('anonymous', 'other-visit');
    expect(await redis.eval(CONTINUE_SESSION, 2, 'anonymous', 'identified', 1800)).toBeNull();
    expect(await redis.get('identified')).toBe('visit');
  });

  it('freezes the first published start across reversed and duplicated updates, preserving large IDs', async () => {
    await bufferSessionUpdate(projectId, 'concurrent', at(0), session('concurrent', 0));
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        bufferSessionUpdate(projectId, 'concurrent', at(i + 1), session('concurrent', i + 1)),
      ),
    );
    await bufferSessionUpdate(projectId, 'concurrent', at(29), session('concurrent', 29));
    // A late earlier event corrects entry metadata but never the published start.
    await bufferSessionUpdate(projectId, 'concurrent', at(-5), session('concurrent', -5));
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'concurrent')).toMatchObject({
      userId,
      projectId,
      startedAt: at(0),
      endedAt: at(30),
      duration: 30,
      pathname: '/entry--5',
    });
    expect(await stateRedis().zcard('vm:{session-state}:dirty')).toBe(0);
  });

  it('buffers early page-leave only in Redis, then persists it with session creation', async () => {
    const key = `vm:{session-state}:${projectId}:leave-first`;
    await bufferSessionUpdate(projectId, 'leave-first', at(60));
    const ttl = await stateRedis().ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(Number(process.env.SESSION_STATE_CACHE_TTL_SECONDS ?? 300));
    expect(await stateRedis().zcard('vm:{session-state}:dirty')).toBe(0);
    const insert = vi.spyOn(clickhouseClient, 'insert');
    expect(await flushSessionBuffer()).toBe(0);
    expect(await flushSessionBuffer(1, [key])).toBe(0);
    expect(insert).not.toHaveBeenCalled();
    const result = await clickhouseClient.query({
      query: "SELECT count() AS count FROM session_v3 WHERE id = 'leave-first'",
      format: 'JSONEachRow',
    });
    expect(await result.json()).toEqual([{ count: '0' }]);
    await bufferSessionUpdate(projectId, 'leave-first', at(0), session('leave-first', 0));
    expect(await stateRedis().ttl(key)).toBe(-1);
    expect(await stateRedis().zcard('vm:{session-state}:dirty')).toBe(1);
    await flushSessionBuffer();
    expect(await stateRedis().ttl(key)).toBeGreaterThan(0);
    expect(await clickhouseSession.findById(projectId, userId, 'leave-first')).toMatchObject({
      duration: 60,
      endedAt: at(60),
    });
  });

  it('allows orphaned activity to expire without blocking flushes or later session creation', async () => {
    const key = `vm:{session-state}:${projectId}:expired-activity`;
    await bufferSessionUpdate(projectId, 'expired-activity', at(60));
    // Force the configured expiry to elapse without waiting five minutes.
    await stateRedis().pexpire(key, 1);
    await vi.waitFor(async () => expect(await stateRedis().exists(key)).toBe(0));
    await bufferSessionUpdate(projectId, 'live', at(0), session('live', 0));
    expect(await flushSessionBuffer(1)).toBe(1);
    expect(await stateRedis().zcard('vm:{session-state}:dirty')).toBe(0);
    await bufferSessionUpdate(projectId, 'expired-activity', at(0), session('expired-activity', 0));
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'expired-activity')).toMatchObject({
      duration: 0,
      endedAt: at(0),
    });
  });

  it('persists deletion tombstones for uninitialized sessions and rejects late creation after cache expiry', async () => {
    const key = `vm:{session-state}:${projectId}:deleted-before-creation`;
    await bufferSessionUpdate(projectId, 'deleted-before-creation', at(60));
    await deleteBufferedSession(projectId, 'deleted-before-creation');
    expect(await stateRedis().ttl(key)).toBe(-1);
    expect(await flushSessionBuffer()).toBe(1);
    await stateRedis().del(key);
    expect(await findPendingSession(projectId, ['deleted-before-creation'])).toBeUndefined();
    await bufferSessionUpdate(projectId, 'deleted-before-creation', at(0), session('deleted-before-creation', 0));
    expect(await flushSessionBuffer()).toBe(0);
    expect(await clickhouseSession.findById(projectId, userId, 'deleted-before-creation')).toBeNull();
  });

  it('does not clear an update that arrives while an older snapshot is being written', async () => {
    await bufferSessionUpdate(projectId, 'during-flush', at(0), session('during-flush', 0));
    const original = clickhouseClient.insert.bind(clickhouseClient);
    let wrote!: () => void;
    let release!: () => void;
    const written = new Promise<void>((resolve) => {
      wrote = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi.spyOn(clickhouseClient, 'insert').mockImplementationOnce(async (options) => {
      const result = await original(options);
      wrote();
      await gate;
      return result;
    });
    const flush = flushSessionBuffer();
    await written;
    await bufferSessionUpdate(projectId, 'during-flush', at(20));
    release();
    await flush;
    expect(await stateRedis().zcard('vm:{session-state}:dirty')).toBe(1);
    expect(await stateRedis().ttl(`vm:{session-state}:${projectId}:during-flush`)).toBe(-1);
    spy.mockRestore();
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'during-flush')).toMatchObject({ duration: 20 });
  });

  it('retries an insert with a lost acknowledgement without duplicating logical sessions', async () => {
    await bufferSessionUpdate(projectId, 'lost-ack', at(0), session('lost-ack', 0));
    const original = clickhouseClient.insert.bind(clickhouseClient);
    vi.spyOn(clickhouseClient, 'insert').mockImplementationOnce(async (options) => {
      await original(options);
      throw new Error('connection lost after commit');
    });
    await expect(flushSessionBuffer()).rejects.toThrow('connection lost');
    expect(await stateRedis().zcard('vm:{session-state}:dirty')).toBe(1);
    await flushSessionBuffer();
    const result = await clickhouseClient.query({
      query: `SELECT count() AS count FROM ${currentSessionRows(projectId)}`,
      format: 'JSONEachRow',
    });
    expect(Number((await result.json<{ count: string }>())[0]!.count)).toBe(1);
  });

  it('hydrates revisions after eviction and batches activity without additional ClickHouse reads', async () => {
    await bufferSessionUpdate(projectId, 'hydrate', at(0), session('hydrate', 0));
    await flushSessionBuffer();
    await stateRedis().del(`vm:{session-state}:${projectId}:hydrate`);
    await bufferExistingSessionActivity(projectId, 'hydrate', at(10));
    const query = vi.spyOn(clickhouseClient, 'query');
    for (let i = 11; i < 20; i++)
      expect(await bufferExistingSessionActivity(projectId, 'hydrate', at(i))).toBe('buffered');
    expect(query).not.toHaveBeenCalled();
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'hydrate')).toMatchObject({ duration: 19 });
  });

  it('keeps the first processed entry for equal timestamps after cache expiry', async () => {
    const key = `vm:{session-state}:${projectId}:entry-tie`;
    await bufferSessionUpdate(projectId, 'entry-tie', at(0), { ...session('entry-tie', 0), pathname: '/b' });
    await flushSessionBuffer();
    await stateRedis().del(key);
    await bufferSessionUpdate(projectId, 'entry-tie', at(0), { ...session('entry-tie', 0), pathname: '/d' });
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'entry-tie')).toMatchObject({ pathname: '/b' });
    await stateRedis().del(key);
    await bufferSessionUpdate(projectId, 'entry-tie', at(0), { ...session('entry-tie', 0), pathname: '/a' });
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'entry-tie')).toMatchObject({ pathname: '/b' });
    await stateRedis().del(key);
    expect(await bufferExistingSessionActivity(projectId, 'entry-tie', at(-1))).toBe('predates');
    await bufferSessionUpdate(projectId, 'entry-tie', at(-1), session('entry-tie', -1));
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'entry-tie')).toMatchObject({
      pathname: '/entry--1',
      startedAt: at(0),
      endedAt: at(0),
    });
  });

  it('fills missing location after reconstructing ClickHouse defaults', async () => {
    await bufferSessionUpdate(projectId, 'empty-geo', at(0), {
      ...session('empty-geo', 0),
      countryCode: '',
      city: '',
      latitude: null,
      longitude: null,
    });
    await flushSessionBuffer();
    await stateRedis().del(`vm:{session-state}:${projectId}:empty-geo`);
    await bufferExistingSessionActivity(projectId, 'empty-geo', at(10), {
      countryCode: 'AT',
      city: 'Vienna',
      latitude: 48,
      longitude: 16,
    });
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'empty-geo')).toMatchObject({
      countryCode: 'AT',
      city: 'Vienna',
      latitude: 48,
      longitude: 16,
    });
  });

  it('keeps the first known location after cache expiry when an earlier event arrives', async () => {
    await bufferSessionUpdate(projectId, 'geo-order', at(0), {
      ...session('geo-order', 0),
      countryCode: '',
      city: '',
      latitude: null,
      longitude: null,
    });
    await bufferExistingSessionActivity(projectId, 'geo-order', at(300), {
      countryCode: 'AT',
      city: 'Vienna',
      latitude: 48,
      longitude: 16,
    });
    await flushSessionBuffer();
    await stateRedis().del(`vm:{session-state}:${projectId}:geo-order`);

    await bufferExistingSessionActivity(projectId, 'geo-order', at(180), {
      countryCode: 'AT',
      city: 'Graz',
      latitude: 47,
      longitude: 15,
    });
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'geo-order')).toMatchObject({
      startedAt: at(0),
      endedAt: at(300),
      city: 'Vienna',
      latitude: 48,
      longitude: 16,
      duration: 300,
    });
  });

  it('retains concurrent target updates while a merged source session is deleted', async () => {
    const targetUser = BigInt('18446744073709551002');
    await bufferSessionUpdate(projectId, 'source', at(0), session('source', 0));
    await bufferSessionUpdate(projectId, 'target', at(30), {
      ...session('target', 30),
      userId: targetUser,
      city: 'Graz',
      latitude: 47,
      longitude: 15,
    });
    await Promise.all([deleteBufferedSession(projectId, 'source'), bufferSessionUpdate(projectId, 'target', at(60))]);
    await bufferSessionUpdate(projectId, 'source', at(90));
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'source')).toBeNull();
    expect(await clickhouseSession.findById(projectId, targetUser, 'target')).toMatchObject({
      startedAt: at(30),
      endedAt: at(60),
      duration: 30,
      city: 'Graz',
      latitude: 47,
      longitude: 15,
    });
    await stateRedis().del(`vm:{session-state}:${projectId}:source`);
    await bufferSessionUpdate(projectId, 'source', at(120));
    await deleteBufferedSession(projectId, 'source');
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'source')).toBeNull();
    expect(await clickhouseSession.findById(projectId, targetUser, 'target')).toMatchObject({ duration: 30 });
  });

  it('completes late source-session jobs without reviving or extending a merged session', async () => {
    const targetUser = userId + BigInt(1);
    await bufferSessionUpdate(projectId, 'late-source', at(0), session('late-source', 0));
    await bufferSessionUpdate(projectId, 'late-target', at(30), {
      ...session('late-target', 30),
      userId: targetUser,
    });
    await flushSessionBuffer();
    await deleteBufferedSession(projectId, 'late-source');
    await flushSessionBuffer();

    const targetBeforeLateJobs = await clickhouseSession.findById(projectId, targetUser, 'late-target');
    const sourceBeforeLateJobs = await clickhouseSession.findLatestRevision(projectId, 'late-source');
    expect(sourceBeforeLateJobs?.deleted).toBe(1);
    // Simulate cache expiry: late jobs must still see the durable ClickHouse tombstone.
    await stateRedis().del(`vm:{session-state}:${projectId}:late-source`);

    const connection = { url: process.env.REDIS_URL };
    const queue = new Queue<SessionQueueProps>(sessionQueueName, { connection });
    const events = new QueueEvents(sessionQueueName, { connection });
    const worker = await initSessionWorker();
    try {
      await events.waitUntilReady();
      const lateCreate = await queue.add('late-create', {
        type: 'createOrExtend',
        projectId: String(projectId),
        userId: String(userId),
        sessionId: 'late-source',
        // Even a job claiming a new session hydrates when it is too old to trust the claim.
        isNewSession: true,
        createdAt: at(90),
        geoData: undefined,
        headers: {},
      });
      await lateCreate.waitUntilFinished(events, 5_000);
      const lateExtend = await queue.add('late-extend', {
        type: 'extend',
        projectId: String(projectId),
        userId: String(userId),
        sessionId: 'late-source',
        createdAt: at(120),
      });
      await lateExtend.waitUntilFinished(events, 5_000);
    } finally {
      await worker.close();
      await events.close();
      await queue.close();
    }
    // An already-running full enrichment path also becomes a no-op after the move.
    await bufferSessionUpdate(projectId, 'late-source', at(-10), session('late-source', -10));
    expect(await flushSessionBuffer()).toBe(0);

    expect(await clickhouseSession.findLatestRevision(projectId, 'late-source')).toEqual(sourceBeforeLateJobs);
    expect(await clickhouseSession.findById(projectId, userId, 'late-source')).toBeNull();
    expect(await clickhouseSession.findById(projectId, targetUser, 'late-target')).toEqual(targetBeforeLateJobs);
  });

  it('lets the creating event set start and entry data when a later event of the session overtakes it', async () => {
    const connection = { url: process.env.REDIS_URL };
    const queue = new Queue<SessionQueueProps>(sessionQueueName, { connection });
    const events = new QueueEvents(sessionQueueName, { connection });
    const worker = await initSessionWorker();
    const base = Date.now() - 10_000;
    const time = (ms: number) => formatClickhouseDate(new Date(base + ms));
    const job = (isNewSession: boolean, ms: number, url: string) => ({
      type: 'createOrExtend' as const,
      projectId: String(projectId),
      userId: String(userId),
      sessionId: 'overtaken',
      isNewSession,
      createdAt: time(ms),
      geoData: undefined,
      headers: {},
      url,
    });
    try {
      await events.waitUntilReady();
      const later = await queue.add('later', job(false, 5_000, 'https://example.com/second'));
      await vi.waitFor(async () => expect(await later.getState()).toBe('delayed'), { timeout: 5_000 });
      const creating = await queue.add('creating', job(true, 0, 'https://example.com/entry'));
      await creating.waitUntilFinished(events, 5_000);
      await later.waitUntilFinished(events, 5_000);
    } finally {
      await worker.close();
      await events.close();
      await queue.close();
    }
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'overtaken')).toMatchObject({
      startedAt: time(0),
      endedAt: time(5_000),
      duration: 5,
      pathname: '/entry',
    });
  });

  it('distinguishes an absent historical session from an initialization placeholder', async () => {
    expect(await findPendingSession(projectId, ['historical-missing'])).toBeUndefined();
    await sessionStore.load(sessionKey(projectId, 'initializing'));
    expect(await findPendingSession(projectId, ['historical-missing', 'initializing'])).toBe('initializing');
    await bufferSessionUpdate(projectId, 'initializing', at(0), session('initializing', 0));
    expect(await findPendingSession(projectId, ['initializing'])).toBeUndefined();
  });

  it.each([BigInt(0), BigInt('18446744073709551002')])(
    'waits for initialization before assigning user %s and preserves ownership after cache expiry',
    async (targetUser) => {
      await bufferSessionUpdate(projectId, 'partial-source', at(60));
      expect(await findPendingSession(projectId, ['partial-source'])).toBe('partial-source');
      await expect(reassignBufferedSession(projectId, 'partial-source', targetUser, 'identified')).rejects.toThrow(
        'not initialized',
      );
      await flushSessionBuffer();
      expect(await findPendingSession(projectId, ['partial-source'])).toBe('partial-source');
      await bufferSessionUpdate(projectId, 'partial-source', at(0), session('partial-source', 0));
      // Readiness does not require a ClickHouse flush.
      expect(await findPendingSession(projectId, ['partial-source'])).toBeUndefined();
      await reassignBufferedSession(projectId, 'partial-source', targetUser, 'identified', 'Canonical Name');
      await flushSessionBuffer();
      await stateRedis().del(`vm:{session-state}:${projectId}:partial-source`);
      await bufferSessionUpdate(projectId, 'partial-source', at(-10), {
        ...session('partial-source', -10),
        userIdentifier: 'old',
        userDisplayName: 'Old Name',
      });
      await flushSessionBuffer();
      expect(await clickhouseSession.findById(projectId, userId, 'partial-source')).toBeNull();
      expect(await clickhouseSession.findById(projectId, targetUser, 'partial-source')).toMatchObject({
        duration: 60,
        userIdentifier: 'identified',
        userDisplayName: 'Canonical Name',
      });
    },
  );

  it('treats deleted sources as settled', async () => {
    await bufferSessionUpdate(projectId, 'source', at(0), session('source', 0));
    expect(await findPendingSession(projectId, ['source', 'missing'])).toBeUndefined();
    await deleteBufferedSession(projectId, 'source');
    await flushSessionBuffer();
    await stateRedis().del(`vm:{session-state}:${projectId}:source`);
    expect(await findPendingSession(projectId, ['source'])).toBeUndefined();
  });

  it('skips the ClickHouse lookup only for recent sessions the hub just created', async () => {
    const spy = vi.spyOn(clickhouseSession, 'findLatestRevision');
    const now = formatClickhouseDate(new Date());
    expect(await bufferExistingSessionActivity(projectId, 'fresh', now, undefined, { knownNew: true })).toBe(
      'uninitialized',
    );
    expect(spy).not.toHaveBeenCalled();
    // The placeholder still marks the initialization for merges.
    expect(await findPendingSession(projectId, ['fresh'])).toBe('fresh');

    // An old job (late retry, backlog replay) whose state may have expired hydrates as before.
    await bufferSessionUpdate(projectId, 'old', at(0), session('old', 0));
    await flushSessionBuffer();
    await stateRedis().del(sessionKey(projectId, 'old'));
    spy.mockClear();
    expect(await bufferExistingSessionActivity(projectId, 'old', at(10), undefined, { knownNew: true })).toBe(
      'buffered',
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await flushSessionBuffer()).toBe(1);
    expect(await clickhouseSession.findById(projectId, userId, 'old')).toMatchObject({ duration: 10 });
  });

  it('keeps flushing other sessions when a dirty state was lost outside the pipeline', async () => {
    await bufferSessionUpdate(projectId, 'lost', at(0), session('lost', 0));
    await bufferSessionUpdate(projectId, 'kept', at(0), session('kept', 0));
    await stateRedis().del(sessionKey(projectId, 'lost'));
    expect(await flushSessionBuffer()).toBe(1);
    expect(await clickhouseSession.findById(projectId, userId, 'kept')).not.toBeNull();
  });

  it('limits per-user session lookups to sessions active in a time range', async () => {
    const time = (seconds: number) => new Date(Date.UTC(2026, 8, 4, 12, 0, seconds));
    await bufferSessionUpdate(projectId, 'early', at(0), session('early', 0));
    await flushSessionBuffer();
    // A later revision extends the session; an older revision alone would not match the range.
    await bufferSessionUpdate(projectId, 'early', at(30));
    await bufferSessionUpdate(projectId, 'late', at(120), session('late', 120));
    await flushSessionBuffer();
    const ids = async (start: number, end: number) =>
      (await clickhouseSession.findByUserId(projectId, userId, { start: time(start), end: time(end) }))
        .map((s) => s.id)
        .sort();
    expect(await ids(20, 60)).toEqual(['early']);
    expect(await ids(31, 119)).toEqual([]);
    expect(await ids(0, 200)).toEqual(['early', 'late']);
    expect(await ids(120, 120)).toEqual(['late']);
  });

  it('caches ingestion user lookups, including missing users, until a user write invalidates them', async () => {
    const spy = vi.spyOn(clickhouseUser, 'findById');
    expect(await findIngestionUser(projectId, userId)).toBeNull();
    expect(await findIngestionUser(projectId, userId)).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);

    await clickhouseInsert({
      table: 'user',
      values: [
        { projectId, id: userId, identifier: 'identified', displayName: 'Ada', createdAt: at(0), updatedAt: at(0) },
      ],
    });
    await invalidateIngestionUser(projectId, userId);
    expect(await findIngestionUser(projectId, userId)).toMatchObject({ identifier: 'identified', displayName: 'Ada' });
    expect(spy).toHaveBeenCalledTimes(2);

    // A lookup that read ClickHouse before a concurrent write must not cache its stale result.
    const otherUser = BigInt('18446744073709551002');
    spy.mockImplementationOnce(async () => {
      await invalidateIngestionUser(projectId, otherUser);
      return null;
    });
    expect(await findIngestionUser(projectId, otherUser)).toBeNull();
    expect(await stateRedis().get(`vm:user-lookup:${projectId}:${otherUser}`)).toBe('-');
  });

  it('does not let an older persisted snapshot hide a pending ownership change', async () => {
    await bufferSessionUpdate(projectId, 'owner', at(0), session('owner', 0));
    await flushSessionBuffer();
    const old = await clickhouseSession.findByUserId(projectId, userId);
    const targetUser = BigInt('18446744073709551002');
    await reassignBufferedSession(projectId, 'owner', targetUser, 'identified');
    expect(await getBufferedSessions(projectId, userId, old)).toEqual([]);
    await bufferSessionUpdate(projectId, 'owner', at(20), session('owner', 20));
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, targetUser, 'owner')).toMatchObject({ duration: 20 });
    // Moving a known session does not establish a general user alias for unrelated later jobs.
    await bufferSessionUpdate(projectId, 'unrelated', at(30), session('unrelated', 30));
    await flushSessionBuffer();
    expect(await clickhouseSession.findById(projectId, userId, 'unrelated')).not.toBeNull();
    expect(await clickhouseSession.findById(projectId, targetUser, 'unrelated')).toBeNull();
  });

  it('deduplicates device inserts, preserves earliest creation, and respects tombstones', async () => {
    const device = {
      projectId,
      userId,
      id: BigInt(42),
      createdAt: at(10),
      osName: 'Linux',
      osVersion: '1',
      clientName: 'Browser',
      clientVersion: '1',
      clientType: 'browser' as const,
      deviceType: 'desktop' as const,
    };
    await Promise.all(Array.from({ length: 10 }, () => clickhouseDevice.insert([device])));
    await clickhouseDevice.insert([{ ...device, createdAt: at(0) }]);
    expect(await clickhouseDevice.findByUserId(projectId, userId)).toMatchObject([
      { id: BigInt(42), createdAt: at(0) },
    ]);
    await clickhouseDevice.delete([device]);
    await clickhouseDevice.insert([{ ...device, createdAt: at(0) }]);
    expect(await clickhouseDevice.findByUserId(projectId, userId)).toEqual([]);
  });

  it('uses shared device cache only after success and skips repeats until it expires', async () => {
    const device = {
      osName: 'Linux',
      osVersion: '1',
      clientName: 'Browser',
      clientVersion: '1',
      clientType: 'browser' as const,
      deviceType: 'desktop' as const,
    };
    const job = { log: async () => 0 };
    const key = `vm:device-written:${projectId}:${userId}:42`;
    const spy = vi.spyOn(clickhouseDevice, 'insert').mockRejectedValueOnce(new Error('failed insert'));
    await expect(insertDeviceIfNotExists(projectId, userId, BigInt(42), device, job)).rejects.toThrow('failed insert');
    expect(await stateRedis().exists(key)).toBe(0);
    await insertDeviceIfNotExists(projectId, userId, BigInt(42), device, job);
    await insertDeviceIfNotExists(projectId, userId, BigInt(42), device, job);
    expect(spy).toHaveBeenCalledTimes(2);
    // Once the marker expires a duplicate insert is allowed again; device_v2 resolves it by revision.
    await stateRedis().del(key);
    await insertDeviceIfNotExists(projectId, userId, BigInt(42), device, job);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(await clickhouseDevice.findByUserId(projectId, userId)).toMatchObject([{ id: BigInt(42) }]);
  });

  it('drains bounded batches without removing sessions that have not been written', async () => {
    await bufferSessionUpdate(projectId, 'batch-a', at(0), session('batch-a', 0));
    await bufferSessionUpdate(projectId, 'batch-b', at(0), session('batch-b', 0));
    expect(await pendingSessionStats()).toMatchObject({ count: 2, oldestAgeSeconds: expect.any(Number) });
    expect(await flushSessionBuffer(1)).toBe(1);
    expect(await stateRedis().zcard('vm:{session-state}:dirty')).toBe(1);
    expect(await flushSessionBuffer(1)).toBe(1);
    expect(await stateRedis().zcard('vm:{session-state}:dirty')).toBe(0);
    expect(await pendingSessionStats()).toEqual({ count: 0, oldestAgeSeconds: 0 });
    expect(await clickhouseSession.findByUserId(projectId, userId)).toHaveLength(2);
  });

  it('gives other pending sessions a turn when a session changes during every flush', async () => {
    await bufferSessionUpdate(projectId, 'hot', at(0), session('hot', 0));
    await bufferSessionUpdate(projectId, 'cold', at(0), session('cold', 0));
    const dirty = 'vm:{session-state}:dirty';
    const hotKey = `vm:{session-state}:${projectId}:hot`;
    const coldKey = `vm:{session-state}:${projectId}:cold`;
    await stateRedis().zadd(dirty, 0, hotKey, 1, coldKey);
    const original = clickhouseClient.insert.bind(clickhouseClient);
    vi.spyOn(clickhouseClient, 'insert').mockImplementationOnce(async (options) => {
      const result = await original(options);
      await bufferSessionUpdate(projectId, 'hot', at(10));
      return result;
    });
    await flushSessionBuffer(1);
    expect(await stateRedis().zrange(dirty, 0, 0)).toEqual([coldKey]);
    await flushSessionBuffer(1);
    expect(await clickhouseSession.findById(projectId, userId, 'cold')).not.toBeNull();
    expect(await stateRedis().zrange(dirty, 0, -1)).toEqual([hotKey]);
    await flushSessionBuffer(1);
    expect(await clickhouseSession.findById(projectId, userId, 'hot')).toMatchObject({ duration: 10 });
    expect(await stateRedis().zcard(dirty)).toBe(0);
  });

  it.each([false, true])(
    'resumed stale flushes preserve newer month-crossing state (pending update: %s)',
    async (pendingUpdate) => {
      const start = '2026-08-31 23:59:50.000';
      await bufferSessionUpdate(projectId, 'month', start, {
        ...session('month', 0),
        startedAt: start,
        endedAt: start,
      });
      const original = clickhouseClient.insert.bind(clickhouseClient);
      let wrote!: () => void;
      let release!: () => void;
      const written = new Promise<void>((resolve) => {
        wrote = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.spyOn(clickhouseClient, 'insert').mockImplementationOnce(async (options) => {
        wrote();
        await gate;
        return original(options);
      });
      const first = flushSessionBuffer();
      await written;
      await bufferSessionUpdate(projectId, 'month', '2026-09-01 00:00:10.000');
      await flushSessionBuffer();
      if (pendingUpdate) await bufferSessionUpdate(projectId, 'month', '2026-09-01 00:00:20.000');
      release();
      await first;
      expect(await clickhouseSession.findById(projectId, userId, 'month')).toMatchObject({
        startedAt: start,
        duration: 20,
      });
      expect(await stateRedis().zcard('vm:{session-state}:dirty')).toBe(pendingUpdate ? 1 : 0);
      if (pendingUpdate) {
        await flushSessionBuffer();
        expect(await clickhouseSession.findById(projectId, userId, 'month')).toMatchObject({ duration: 30 });
      }
    },
  );

  it('resolves per-user lookups through candidate ids across ownership changes and tombstones', async () => {
    const otherUser = userId + BigInt(2);
    const ids = async (user: bigint) => (await clickhouseSession.findByUserId(projectId, user)).map((s) => s.id).sort();

    await bufferSessionUpdate(projectId, 'owned', at(0), session('owned', 0));
    await bufferSessionUpdate(projectId, 'moved', at(5), { ...session('moved', 5), userId: otherUser });
    await flushSessionBuffer();

    expect(await ids(userId)).toEqual(['owned']);
    expect(await ids(otherUser)).toEqual(['moved']);
    expect((await clickhouseSession.findLatestByUserId(projectId, userId))?.id).toBe('owned');

    // Ownership moves to userId; the old-owner candidate must be filtered out by the owner check.
    await reassignBufferedSession(projectId, 'moved', userId, 'identified', 'Name');
    await flushSessionBuffer();
    expect(await ids(otherUser)).toEqual([]);
    expect(await ids(userId)).toEqual(['moved', 'owned']);
    expect((await clickhouseSession.findLatestByUserId(projectId, userId))?.id).toBe('moved');

    // A tombstone drops it from the candidate set as well.
    await deleteBufferedSession(projectId, 'owned');
    await flushSessionBuffer();
    expect(await ids(userId)).toEqual(['moved']);
    expect((await clickhouseSession.findLatestByUserId(projectId, userId))?.id).toBe('moved');
  });
});
