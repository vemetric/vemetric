import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clickhouseClient, clickhouseInsert } from '../src/client';
import { clickhouseDevice } from '../src/models/device';
import { clickhouseEvent } from '../src/models/event';
import { clickhouseSession, currentSessionRows, type ClickhouseSession } from '../src/models/session';
import { clickhouseUser } from '../src/models/user';
import { getUserFilterQueries } from '../src/utils/filters';

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

describe.skipIf(process.env.INGESTION_STATE_TESTS !== '1')('session_v3 and device_v2 reads against ClickHouse', () => {
  beforeAll(() => {
    if (!process.env.CLICKHOUSE_DB?.startsWith('vm_concurrency_test_')) {
      throw new Error('Use an isolated vm_concurrency_test_* database');
    }
  });
  beforeEach(async () => {
    for (const table of ['session_v3', 'device_v2', 'user'])
      await clickhouseClient.command({ query: `TRUNCATE TABLE ${table}` });
  });
  afterAll(async () => {
    await clickhouseClient.close();
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
        "SELECT referrerUrl, referrerType, queryParams, deleted FROM session_v3 WHERE id = 'defaults'",
      format: 'JSONEachRow',
    });
    expect(await result.json()).toEqual([
      { referrerUrl: 'example.com', referrerType: 'unknown', queryParams: '', deleted: 0 },
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
  });

  it('resolves revisions before deletion filters and aggregation in dashboard queries', async () => {
    await clickhouseInsert({
      table: 'session_v3',
      values: [
        // Revisions share the immutable start; only the other fields change.
        { ...session('revised', 0), revision: '1', endedAt: at(30), duration: 30, referrer: 'old.example' },
        { ...session('revised', 0), revision: '2', endedAt: at(90), duration: 90, referrer: 'new.example' },
        { ...session('deleted-row', 0), revision: '1', endedAt: at(100), duration: 100, referrer: 'deleted.example' },
        { ...session('deleted-row', 0), revision: '2', endedAt: at(100), duration: 100, deleted: 1 },
        { ...session('live', 0), revision: '1', endedAt: at(30), duration: 30, referrer: 'live.example' },
      ],
    });
    const options = {
      startDate: new Date(at(0).replace(' ', 'T') + 'Z'),
      endDate: new Date(at(60).replace(' ', 'T') + 'Z'),
      filterQueries: '',
      filterConfig: undefined,
    };
    // Only the current rows count: avg(90, 30). Stale revisions or the tombstoned row would change it.
    expect(
      await clickhouseSession.queryApiVisitDurationRows({ projectId, ...options, grouping: { kind: 'none' } }),
    ).toEqual([{ groupKey: '__all__', value: 60 }]);
    expect(
      await clickhouseSession.getVisitDurationTimeSeries(projectId, { ...options, timeSpan: '1hr' }),
    ).toMatchObject([{ count: 60, sessionCount: 2 }]);
    const filterable = await clickhouseEvent.getFilterableData(projectId, options.startDate, options.endDate);
    expect([...filterable.sources.referrers].sort()).toEqual(['live.example', 'new.example']);
    expect(await clickhouseSession.getCountryCodes(projectId, options)).toEqual([{ countryCode: 'AT', users: 1 }]);
    expect(await clickhouseSession.getCities(projectId, options)).toEqual([
      { city: 'Vienna', countryCode: 'AT', users: 1 },
    ]);
    const sources = await clickhouseSession.getTopSources(projectId, 'referrer', options);
    expect(sources.map((source) => source.referrer).sort()).toEqual(['live.example', 'new.example']);
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

  it('limits per-user session lookups to sessions active in a time range', async () => {
    const time = (seconds: number) => new Date(Date.UTC(2026, 8, 4, 12, 0, seconds));
    await clickhouseInsert({
      table: 'session_v3',
      values: [
        { ...session('early', 0), revision: '1' },
        // A later revision extends the session; the older revision alone would not match the range.
        { ...session('early', 0), revision: '2', endedAt: at(30), duration: 30 },
        { ...session('late', 120), revision: '1' },
      ],
    });
    const ids = async (start: number, end: number) =>
      (await clickhouseSession.findByUserId(projectId, userId, { start: time(start), end: time(end) }))
        .map((s) => s.id)
        .sort();
    expect(await ids(20, 60)).toEqual(['early']);
    expect(await ids(31, 119)).toEqual([]);
    expect(await ids(0, 200)).toEqual(['early', 'late']);
    expect(await ids(120, 120)).toEqual(['late']);
  });

  it('resolves per-user lookups through candidate ids across ownership changes and tombstones', async () => {
    const otherUser = userId + BigInt(2);
    const ids = async (user: bigint) => (await clickhouseSession.findByUserId(projectId, user)).map((s) => s.id).sort();

    await clickhouseInsert({
      table: 'session_v3',
      values: [
        { ...session('owned', 0), revision: '1' },
        { ...session('moved', 5), userId: otherUser, revision: '1' },
      ],
    });
    expect(await ids(userId)).toEqual(['owned']);
    expect(await ids(otherUser)).toEqual(['moved']);
    expect((await clickhouseSession.findLatestByUserId(projectId, userId))?.id).toBe('owned');

    // Ownership moves to userId; the old-owner candidate must be filtered out by the owner check.
    await clickhouseInsert({
      table: 'session_v3',
      values: [{ ...session('moved', 5), revision: '2', userIdentifier: 'identified', userDisplayName: 'Name' }],
    });
    expect(await ids(otherUser)).toEqual([]);
    expect(await ids(userId)).toEqual(['moved', 'owned']);
    expect((await clickhouseSession.findLatestByUserId(projectId, userId))?.id).toBe('moved');

    // A tombstone drops it from the candidate set as well.
    await clickhouseInsert({ table: 'session_v3', values: [{ ...session('owned', 0), revision: '2', deleted: 1 }] });
    expect(await ids(userId)).toEqual(['moved']);
    expect((await clickhouseSession.findLatestByUserId(projectId, userId))?.id).toBe('moved');
  });

  it('resolves device revisions before joining users, including earliest creation and tombstones', async () => {
    const joined = { ...device, id: BigInt(345), clientName: 'Later' };
    await clickhouseDevice.insert([joined, { ...joined, createdAt: at(0), clientName: 'Earlier' }]);
    await clickhouseInsert({
      table: 'user',
      values: [
        {
          projectId,
          id: userId,
          identifier: 'device-join',
          initialDeviceId: joined.id,
          createdAt: at(0),
          updatedAt: at(0),
        },
      ],
    });
    expect(await clickhouseUser.findById(projectId, userId, true)).toMatchObject({ device: { clientName: 'Earlier' } });
    await clickhouseDevice.delete([joined]);
    expect(await clickhouseDevice.findByUserId(projectId, userId)).toEqual([]);
    const user = await clickhouseUser.findById(projectId, userId, true);
    expect(user?.device?.clientName ?? '').toBe('');
  });

  it('deduplicates device inserts, preserves earliest creation, and respects tombstones', async () => {
    await Promise.all(Array.from({ length: 10 }, () => clickhouseDevice.insert([device])));
    await clickhouseDevice.insert([{ ...device, createdAt: at(0) }]);
    expect(await clickhouseDevice.findByUserId(projectId, userId)).toMatchObject([
      { id: BigInt(42), createdAt: at(0) },
    ]);
    await clickhouseDevice.delete([device]);
    await clickhouseDevice.insert([{ ...device, createdAt: at(0) }]);
    expect(await clickhouseDevice.findByUserId(projectId, userId)).toEqual([]);
  });
});
