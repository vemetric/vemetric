import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickhouseClient } from '../src/client';
import { backfillIngestion } from '../src/ingestion-backfill';

const projectId = '18446744073709551000';
const legacySession = {
  projectId,
  userId: '18446744073709551001',
  id: 'session',
  startedAt: '2026-08-31 23:59:00.000',
  endedAt: '2026-09-01 00:01:00.000',
  city: 'Vienna',
  countryCode: 'AT',
  referrer: 'example.com',
  queryParams: '?campaign=test',
  userIdentifier: 'previous',
  latitude: 48,
  longitude: 16,
};
const legacyDevice = {
  projectId,
  userId: legacySession.userId,
  id: '18446744073709551002',
  createdAt: '2026-08-31 23:59:00.000',
  osName: 'Linux',
  sign: 1,
};
async function rows(query: string) {
  return (await clickhouseClient.query({ query, format: 'JSONEachRow' })).json();
}
async function seed() {
  await clickhouseClient.insert({
    table: 'session',
    format: 'JSONEachRow',
    values: [
      legacySession,
      { ...legacySession, endedAt: '2026-09-01 00:02:00.000', userIdentifier: null, latitude: null },
      { ...legacySession, projectId: '2', id: 'deleted', deleted: 1 },
      { ...legacySession, projectId: '3', id: '' },
    ],
  });
  await clickhouseClient.insert({
    table: 'device',
    format: 'JSONEachRow',
    values: [
      legacyDevice,
      { ...legacyDevice, createdAt: '2026-09-01 00:01:00.000', osName: 'Later' },
      { ...legacyDevice, projectId: '2', id: '42' },
      { ...legacyDevice, projectId: '2', id: '42', sign: -1 },
    ],
  });
}

describe.skipIf(process.env.INGESTION_STATE_TESTS !== '1')('ingestion backfill against ClickHouse', () => {
  beforeAll(() => {
    if (!process.env.CLICKHOUSE_DB?.startsWith('vm_concurrency_test_')) {
      throw new Error('Use an isolated vm_concurrency_test_* database');
    }
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    for (const table of ['session', 'device', 'session_v3', 'device_v2']) {
      await clickhouseClient.command({ query: `TRUNCATE TABLE ${table}` });
    }
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await clickhouseClient.close();
  });

  it('verifies legacy logical rows and preserves source data', async () => {
    await seed();
    const original = await rows('SELECT * FROM session FINAL ORDER BY projectId, endedAt');
    await backfillIngestion(clickhouseClient, { writersStopped: true });
    expect(await rows('SELECT * FROM session FINAL ORDER BY projectId, endedAt')).toEqual(original);
    expect(
      await rows(`SELECT projectId, userId, id, city, userIdentifier, latitude, longitude,
      referrerUrl, referrerType, queryParams, revision, deleted FROM session_v3`),
    ).toEqual([
      {
        projectId,
        userId: legacySession.userId,
        id: 'session',
        city: 'Vienna',
        userIdentifier: null,
        latitude: null,
        longitude: 16,
        referrerUrl: 'example.com',
        referrerType: 'unknown',
        queryParams: '?campaign=test',
        revision: '1',
        deleted: 0,
      },
    ]);
    expect(await rows('SELECT projectId, id, createdAt, osName, deleted FROM device_v2')).toEqual([
      {
        projectId,
        id: legacyDevice.id,
        createdAt: legacyDevice.createdAt,
        osName: 'Linux',
        deleted: 0,
      },
    ]);
    // Repeating the backfill before live writes is safe without a completion marker.
    await backfillIngestion(clickhouseClient, { writersStopped: true });
    expect(await rows('SELECT count() AS count FROM session_v3')).toEqual([{ count: '1' }]);
    expect(await rows('SELECT count() AS count FROM device_v2')).toEqual([{ count: '1' }]);
  });

  it('resumes after an acknowledged insert is lost, without duplicate copies or premature completion', async () => {
    await seed();
    const progress = vi.fn();
    const command = clickhouseClient.command.bind(clickhouseClient);
    const spy = vi.spyOn(clickhouseClient, 'command').mockImplementation(async (args) => {
      const result = await command(args);
      if (args.query.startsWith('INSERT INTO session_v3')) throw new Error('lost acknowledgement');
      return result;
    });
    await expect(backfillIngestion(clickhouseClient, { writersStopped: true, progress })).rejects.toThrow(
      'lost acknowledgement',
    );
    expect(progress).not.toHaveBeenCalledWith(expect.stringContaining('Backfill complete.'));
    spy.mockRestore();
    expect(await rows('SELECT count() AS count FROM session_v3')).toEqual([{ count: '1' }]);
    await backfillIngestion(clickhouseClient, { writersStopped: true, progress });
    expect(await rows('SELECT count() AS count FROM session_v3')).toEqual([{ count: '1' }]);
    expect(progress).toHaveBeenCalledWith(expect.stringContaining('Backfill complete.'));
  });

  it('rejects unexpected target rows, including projects absent from the legacy tables', async () => {
    await clickhouseClient.insert({ table: 'session_v3', format: 'JSONEachRow', values: [legacySession] });
    await expect(backfillIngestion(clickhouseClient, { writersStopped: true })).rejects.toThrow('verification failed');
    expect(await rows('SELECT count() AS count FROM session_v3')).toEqual([{ count: '1' }]);
  });

  it.each(['session_v3', 'device_v2'])('rejects an otherwise matching %s tombstone', async (table) => {
    await seed();
    await backfillIngestion(clickhouseClient, { writersStopped: true });
    const snapshots = await rows(`SELECT * FROM ${table}`);
    await clickhouseClient.command({ query: `TRUNCATE TABLE ${table}` });
    // Keep both physical versions visible while verifying the deletion mismatch.
    await clickhouseClient.command({ query: `SYSTEM STOP MERGES ${table}` });
    try {
      await clickhouseClient.insert({
        table,
        format: 'JSONEachRow',
        values: snapshots.map((snapshot) => ({ ...(snapshot as Record<string, unknown>), deleted: 1 })),
      });
      const progress = vi.fn();
      await expect(backfillIngestion(clickhouseClient, { writersStopped: true, progress })).rejects.toThrow(
        `Backfill verification failed: project ${projectId}, ${table}; keep workers stopped`,
      );
      expect(progress).not.toHaveBeenCalledWith(expect.stringContaining('Backfill complete.'));
    } finally {
      await clickhouseClient.command({ query: `SYSTEM START MERGES ${table}` });
    }
  });

  it('ignores cancelled earlier device versions even before background merges', async () => {
    await clickhouseClient.insert({
      table: 'device',
      format: 'JSONEachRow',
      values: [
        legacyDevice,
        { ...legacyDevice, sign: -1 },
        { ...legacyDevice, createdAt: '2026-09-01 00:01:00.000', osName: 'Current' },
      ],
    });
    await backfillIngestion(clickhouseClient, { writersStopped: true });
    expect(await rows('SELECT createdAt, osName FROM device_v2')).toEqual([
      { createdAt: '2026-09-01 00:01:00.000', osName: 'Current' },
    ]);
  });

  it('requires the explicit stopped-writers assertion, including for an empty installation', async () => {
    await expect(backfillIngestion(clickhouseClient, { writersStopped: false })).rejects.toThrow('--writers-stopped');
    await backfillIngestion(clickhouseClient, { writersStopped: true });
  });
});
