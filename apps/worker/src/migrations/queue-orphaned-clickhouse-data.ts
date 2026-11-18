/* eslint-disable no-console */
// One-off: queues the ClickHouse data of projects deleted before the deletion queue existed (they only lost their
// Postgres row). The worker's nightly `clickhouse-deletion` job deletes it, see clickhouse-deletion-worker.ts.
//
// Lists every project id that has rows in an analytics table but no Postgres project and no queued deletion yet.
// Only reads ClickHouse; with --execute it inserts ClickhouseDeletion rows (reason `orphaned`) into Postgres.
//
//   bun --env-file=../../.env.scripts run src/migrations/queue-orphaned-clickhouse-data.ts            # dry run
//   bun --env-file=../../.env.scripts run src/migrations/queue-orphaned-clickhouse-data.ts --execute
//
// Like the other scripts here, ClickHouse is reached via CH_MIGRATIONS_* (e.g. the SSH tunnel), Postgres via
// DATABASE_URL. Credentials: read them into the shell instead of the file.
import { createClient } from '@clickhouse/client-web';
import { dbClickhouseDeletion, prismaClient } from 'database';

const execute = process.argv.includes('--execute');

const missing = ['DATABASE_URL', 'CH_MIGRATIONS_HOST', 'CH_MIGRATIONS_DB'].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing ${missing.join(', ')}.`);
  process.exit(1);
}

const clickhouse = createClient({
  database: process.env.CH_MIGRATIONS_DB,
  url: process.env.CH_MIGRATIONS_HOST,
  username: process.env.CH_MIGRATIONS_USER ?? 'default',
  password: process.env.CH_MIGRATIONS_PASSWORD ?? '',
  request_timeout: 10 * 60 * 1000,
  clickhouse_settings: { output_format_json_quote_64bit_integers: 1, readonly: '2' },
});

async function query<T>(sql: string) {
  return (await (await clickhouse.query({ query: sql, format: 'JSONEachRow' })).json()) as T[];
}

async function main() {
  const database = new URL(process.env.DATABASE_URL as string);
  console.log(`ClickHouse: ${process.env.CH_MIGRATIONS_HOST} / ${process.env.CH_MIGRATIONS_DB}`);
  console.log(`Postgres:   ${database.hostname}:${database.port || 5432}${database.pathname}\n`);

  const tables = (
    await query<{ table: string }>(
      `SELECT table FROM system.columns
       WHERE database = currentDatabase() AND name = 'projectId'
         AND table IN (SELECT name FROM system.tables WHERE database = currentDatabase() AND engine LIKE '%MergeTree%')
       ORDER BY table`,
    )
  ).map((row) => row.table);

  const stored = new Map<string, Record<string, number>>();
  for (const table of tables) {
    const rows = await query<{ projectId: string; rows: string }>(
      `SELECT toString(projectId) AS projectId, count() AS rows FROM \`${table}\` GROUP BY projectId`,
    );
    for (const row of rows) stored.set(row.projectId, { ...stored.get(row.projectId), [table]: Number(row.rows) });
  }

  const existing = new Set((await prismaClient.project.findMany({ select: { id: true } })).map((p) => p.id));
  const queued = new Set(await dbClickhouseDeletion.findQueuedProjectIds());
  const orphaned = Array.from(stored.entries()).filter(([id]) => !existing.has(id) && !queued.has(id));

  console.log(
    `${stored.size} project ids in ClickHouse, ${existing.size} projects in Postgres, ${queued.size} already queued.`,
  );
  console.log(`${orphaned.length} orphaned:\n`);
  const totals: Record<string, number> = {};
  for (const [id, rows] of orphaned) {
    console.log(
      `  ${id}  ${Object.entries(rows)
        .map(([table, count]) => `${table} ${count.toLocaleString('en-US')}`)
        .join(' · ')}`,
    );
    for (const [table, count] of Object.entries(rows)) totals[table] = (totals[table] ?? 0) + count;
  }
  console.log(
    `\nTotal rows: ${
      Object.entries(totals)
        .map(([table, count]) => `${table} ${count.toLocaleString('en-US')}`)
        .join(' · ') || 'none'
    }`,
  );

  if (!execute) {
    console.log('\nDry run. Run with --execute to queue them for the nightly deletion.');
    return;
  }
  for (const [id] of orphaned) {
    await dbClickhouseDeletion.queueProject(id, 'orphaned');
  }
  console.log(`\nQueued ${orphaned.length} projects. The worker deletes them in its next nightly run.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaClient.$disconnect();
    await clickhouse.close();
  });
