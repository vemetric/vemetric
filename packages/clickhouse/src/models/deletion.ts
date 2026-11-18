import { clickhouseClient } from '../client';

// Deleting analytics data (deleted projects, single users of a project) with lightweight deletes.
//
// `ALTER TABLE … DELETE` rewrites every part that holds a matching row, all columns of it. Parts mix many projects,
// so deleting one project comes close to rewriting the table. A lightweight delete only writes a small mask
// (`_row_exists`) per affected part: the rows are hidden right away and dropped on later merges. Big old parts may not
// be merged for a long time, so `applyDeletedMasks` removes the masked rows physically, batched for all deletions.
//
// All statements run asynchronously in ClickHouse; we wait by polling `system.mutations` instead of keeping one HTTP
// request open for the whole time. A statement that timed out keeps running in ClickHouse, and repeating it is harmless.

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

async function query<T>(sql: string, params: Record<string, unknown> = {}) {
  const result = await clickhouseClient.query({ query: sql, query_params: params, format: 'JSONEachRow' });
  return (await result.json()) as T[];
}

/** MergeTree tables of the analytics database with the given column (views and other engines are left out). */
async function getTablesWithColumn(column: string) {
  const rows = await query<{ table: string }>(
    `SELECT table FROM system.columns
     WHERE database = currentDatabase() AND name = {column:String}
       AND table IN (SELECT name FROM system.tables WHERE database = currentDatabase() AND engine LIKE '%MergeTree%')
     ORDER BY table`,
    { column },
  );
  return rows.map((row) => row.table);
}

/** Tables with per-user rows, and the column holding the analytics user id (`id` in `user`). */
async function getUserTables() {
  const tables = (await getTablesWithColumn('userId')).filter((table) => table !== 'user');
  return [{ table: 'user', column: 'id' }, ...tables.map((table) => ({ table, column: 'userId' }))];
}

async function serverNow() {
  const [row] = await query<{ now: string }>('SELECT toString(now()) AS now');
  return row.now;
}

/** Waits until every mutation started on `tables` since `since` is done; throws if one fails or it takes too long. */
async function waitForMutations(tables: string[], since: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const pending = await query<{ table: string; mutation_id: string; latest_fail_reason: string }>(
      `SELECT table, mutation_id, latest_fail_reason FROM system.mutations
       WHERE database = currentDatabase() AND table IN {tables:Array(String)} AND create_time >= {since:DateTime}
         AND is_done = 0`,
      { tables, since },
    );
    if (pending.length === 0) return;

    const failed = pending.find((mutation) => mutation.latest_fail_reason);
    if (failed) {
      throw new Error(`Mutation ${failed.mutation_id} on ${failed.table} failed: ${failed.latest_fail_reason}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`Mutations still running after ${timeoutMs / 1000}s: ${pending.map((m) => m.table).join(', ')}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
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
  getTablesWithColumn,

  /** Deletes all analytics data of the projects. */
  deleteProjects: async (projectIds: Array<string | bigint>, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    if (projectIds.length === 0) return;
    const statements: Array<{ table: string; sql: string }> = [];
    for (const table of await getTablesWithColumn('projectId')) {
      for (let i = 0; i < projectIds.length; i += CHUNK_SIZE) {
        const ids = toUInt64List(projectIds.slice(i, i + CHUNK_SIZE));
        statements.push({ table, sql: `DELETE FROM \`${table}\` WHERE projectId IN (${ids})` });
      }
    }
    await runStatements(statements, timeoutMs);
  },

  /** Deletes the data of single analytics users of a project. */
  deleteProjectUsers: async (
    projectId: string | bigint,
    userIds: Array<string | bigint>,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) => {
    if (userIds.length === 0) return;
    const project = toUInt64List([projectId]);
    const users = toUInt64List(userIds);
    const statements = (await getUserTables()).map(({ table, column }) => ({
      table,
      sql: `DELETE FROM \`${table}\` WHERE projectId = ${project} AND ${column} IN (${users})`,
    }));
    await runStatements(statements, timeoutMs);
  },

  /** Physically removes all rows hidden by lightweight deletes (rewrites only the parts that have masked rows). */
  applyDeletedMasks: async (timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const tables = await getTablesWithColumn('projectId');
    await runStatements(
      tables.map((table) => ({ table, sql: `ALTER TABLE \`${table}\` APPLY DELETED MASK` })),
      timeoutMs,
    );
  },

  /** Every project id with data in any analytics table, with the stored rows per table. */
  getStoredProjects: async () => {
    const projects = new Map<string, Record<string, number>>();
    for (const table of await getTablesWithColumn('projectId')) {
      const rows = await query<{ projectId: string; rows: string }>(
        `SELECT toString(projectId) AS projectId, count() AS rows FROM \`${table}\` GROUP BY projectId`,
      );
      for (const row of rows) {
        projects.set(row.projectId, { ...projects.get(row.projectId), [table]: Number(row.rows) });
      }
    }
    return projects;
  },
};
