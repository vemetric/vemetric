import type { ClickHouseClient } from '@clickhouse/client-web';
import { clickhouseClient } from '../client';

// Deleting analytics data (deleted projects, single users of a project) with lightweight deletes.
//
// `ALTER TABLE … DELETE` rewrites every part that holds a matching row, all columns of it. Parts mix many projects,
// so deleting one project comes close to rewriting the table. A lightweight delete only writes a small mask
// (`_row_exists`) per affected part: the rows are hidden right away and dropped on later merges. Big old parts may not
// be merged for a long time, so `applyDeletedMasks` removes the masked rows physically, batched for all deletions.
//
// All statements run asynchronously in ClickHouse; we wait by polling `system.mutations` instead of keeping one HTTP
// request open for the whole time. ClickHouse retries failing mutations by itself, so a failure reason alone doesn't end
// the wait. If they aren't done by the deadline, they're killed, so a stuck mutation can't block every later one on the
// table; repeating the deletes in the next run is harmless.

/**
 * Every analytics table with per-project data, the column holding the analytics user id, and the column with the time
 * the hub accepted a row's data (for deleting only what a user tracked before a point in time). Deletions only touch
 * these tables. When adding a table with a `projectId` column, add it here: `checkTableList` fails every deletion run
 * until then, so a forgotten table shows up as a failed job instead of data that's silently kept.
 */
export const DELETION_TABLES = [
  { table: 'event', userIdColumn: 'userId', timeColumn: 'createdAt' },
  { table: 'session_v3', userIdColumn: 'userId', timeColumn: 'startedAt' },
  { table: 'device_v2', userIdColumn: 'userId', timeColumn: 'createdAt' },
  { table: 'user', userIdColumn: 'id', timeColumn: 'createdAt' },
] as const;

const POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const CHUNK_SIZE = 500;

// Ids are numeric (UInt64), checked before they are inlined.
const toUInt64List = (ids: Array<string | bigint>) => {
  const values = ids.map(String);
  for (const value of values) {
    if (!/^\d+$/.test(value)) throw new Error(`Unexpected id: ${value}`);
  }
  return values.join(', ');
};

async function query<T>(
  sql: string,
  params: Record<string, unknown> = {},
  client: ClickHouseClient = clickhouseClient,
) {
  const result = await client.query({ query: sql, query_params: params, format: 'JSONEachRow' });
  return (await result.json()) as T[];
}

/**
 * Compares `DELETION_TABLES` with the database: throws if a MergeTree table has a `projectId` column but isn't listed,
 * or a listed table (or one of its columns) doesn't exist anymore.
 */
async function checkTableList(client: ClickHouseClient = clickhouseClient) {
  const rows = await query<{ table: string; columns: string[] }>(
    `SELECT table, groupArray(name) AS columns FROM system.columns
     WHERE database = currentDatabase()
       AND table IN (SELECT name FROM system.tables WHERE database = currentDatabase() AND engine LIKE '%MergeTree%')
     GROUP BY table`,
    {},
    client,
  );
  const columns = new Map(rows.map((row) => [row.table, row.columns]));
  const listed = new Set<string>(DELETION_TABLES.map((entry) => entry.table));

  const unlisted = rows
    .filter((row) => row.columns.includes('projectId') && !listed.has(row.table))
    .map((r) => r.table);
  const stale = DELETION_TABLES.filter((entry) => {
    const tableColumns = columns.get(entry.table) ?? [];
    return [entry.userIdColumn, entry.timeColumn, 'projectId'].some((column) => !tableColumns.includes(column));
  }).map((entry) => `${entry.table} (projectId, ${entry.userIdColumn}, ${entry.timeColumn})`);

  const problems = [
    ...(unlisted.length ? [`tables with projectId missing in DELETION_TABLES: ${unlisted.join(', ')}`] : []),
    ...(stale.length ? [`DELETION_TABLES entries not found in the database: ${stale.join(', ')}`] : []),
  ];
  if (problems.length > 0) {
    throw new Error(
      `Deletion table list is out of date (packages/clickhouse/src/models/deletion.ts): ${problems.join('; ')}`,
    );
  }
}

async function serverNow() {
  const [row] = await query<{ now: string }>('SELECT toString(now()) AS now');
  return row.now;
}

/**
 * Waits until every mutation started on `tables` since `since` is done. Past the deadline the unfinished ones are
 * killed and it throws, with the last failure reason if ClickHouse reported one.
 */
async function waitForMutations(tables: string[], since: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastFailReason = '';
  for (;;) {
    const pending = await query<{ table: string; mutation_id: string; latest_fail_reason: string }>(
      `SELECT table, mutation_id, latest_fail_reason FROM system.mutations
       WHERE database = currentDatabase() AND table IN {tables:Array(String)} AND create_time >= {since:DateTime}
         AND is_done = 0`,
      { tables, since },
    );
    if (pending.length === 0) return;

    const failed = pending.find((mutation) => mutation.latest_fail_reason);
    if (failed) lastFailReason = `${failed.table}: ${failed.latest_fail_reason}`;
    if (Date.now() > deadline) {
      await killMutations(pending);
      throw new Error(
        `Mutations not done after ${timeoutMs / 1000}s, killed: ${pending.map((m) => `${m.table} ${m.mutation_id}`).join(', ')}` +
          (lastFailReason ? `. Last failure: ${lastFailReason}` : ''),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Mutation ids are numbered per table, so the same id can exist on another table: kill exact (table, id) pairs.
async function killMutations(mutations: Array<{ table: string; mutation_id: string }>) {
  for (const value of mutations.flatMap((mutation) => [mutation.table, mutation.mutation_id])) {
    if (!/^[\w.-]+$/.test(value)) throw new Error(`Unexpected mutation table or id: ${value}`);
  }
  const pairs = mutations.map((mutation) => `('${mutation.table}', '${mutation.mutation_id}')`).join(', ');
  await clickhouseClient.command({
    query: `KILL MUTATION WHERE database = currentDatabase() AND (table, mutation_id) IN (${pairs})`,
  });
}

async function runStatements(statements: Array<{ table: string; sql: string }>, timeoutMs: number) {
  if (statements.length === 0) return;
  const since = await serverNow();
  for (const { sql } of statements) {
    await clickhouseClient.command({
      query: sql,
      clickhouse_settings: { lightweight_deletes_sync: '0', mutations_sync: '0' },
    });
  }
  await waitForMutations(Array.from(new Set(statements.map((statement) => statement.table))), since, timeoutMs);
}

export const clickhouseDeletion = {
  checkTableList,

  /** Deletes all analytics data of the projects. */
  deleteProjects: async (projectIds: Array<string | bigint>, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    if (projectIds.length === 0) return;
    await checkTableList();
    const statements: Array<{ table: string; sql: string }> = [];
    for (const { table } of DELETION_TABLES) {
      for (let i = 0; i < projectIds.length; i += CHUNK_SIZE) {
        const ids = toUInt64List(projectIds.slice(i, i + CHUNK_SIZE));
        statements.push({ table, sql: `DELETE FROM \`${table}\` WHERE projectId IN (${ids})` });
      }
    }
    await runStatements(statements, timeoutMs);
  },

  /**
   * Deletes the data of single analytics users of a project. With `before`, only what the hub accepted before that time
   * (data written late), keeping what the same user ids tracked afterwards.
   */
  deleteProjectUsers: async (
    projectId: string | bigint,
    userIds: Array<string | bigint>,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    before?: Date,
  ) => {
    if (userIds.length === 0) return;
    const project = toUInt64List([projectId]);
    const users = toUInt64List(userIds);
    // toISOString() is always `YYYY-MM-DDTHH:mm:ss.sssZ`, safe to inline.
    const beforeTime = before ? `'${before.toISOString().replace('T', ' ').replace('Z', '')}'` : undefined;
    await checkTableList();
    const statements = DELETION_TABLES.map(({ table, userIdColumn, timeColumn }) => ({
      table,
      sql:
        `DELETE FROM \`${table}\` WHERE projectId = ${project} AND ${userIdColumn} IN (${users})` +
        (beforeTime ? ` AND ${timeColumn} < toDateTime64(${beforeTime}, 3, 'UTC')` : ''),
    }));
    await runStatements(statements, timeoutMs);
  },

  /** The device ids of single analytics users of a project, to clear caches that point to them. */
  findProjectUserDevices: async (projectId: string | bigint, userIds: Array<string | bigint>) => {
    if (userIds.length === 0) return [];
    return query<{ userId: string; id: string }>(
      `SELECT DISTINCT toString(userId) AS userId, toString(id) AS id FROM device_v2
       WHERE projectId = ${toUInt64List([projectId])} AND userId IN (${toUInt64List(userIds)})`,
    );
  },

  /** Physically removes all rows hidden by lightweight deletes (rewrites only the parts that have masked rows). */
  applyDeletedMasks: async (timeoutMs = DEFAULT_TIMEOUT_MS) => {
    await checkTableList();
    await runStatements(
      DELETION_TABLES.map(({ table }) => ({ table, sql: `ALTER TABLE \`${table}\` APPLY DELETED MASK` })),
      timeoutMs,
    );
  },

  /**
   * Every project id with data in the deletion tables, with the stored rows per table. Takes a client so scripts can use
   * their own connection (e.g. `CH_MIGRATIONS_*`).
   */
  getStoredProjects: async (client: ClickHouseClient = clickhouseClient) => {
    await checkTableList(client);
    const projects = new Map<string, Record<string, number>>();
    for (const { table } of DELETION_TABLES) {
      const rows = await query<{ projectId: string; rows: string }>(
        `SELECT toString(projectId) AS projectId, count() AS rows FROM \`${table}\` GROUP BY projectId`,
        {},
        client,
      );
      for (const row of rows) {
        projects.set(row.projectId, { ...projects.get(row.projectId), [table]: Number(row.rows) });
      }
    }
    return projects;
  },
};
