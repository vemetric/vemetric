/* eslint-disable no-console */
/**
 * Migration rehearsal on a COPY of production ClickHouse: applies migration 15, runs the real
 * backfill with timing, and compares the dashboard queries of `--base` (legacy tables) and the
 * current checkout (new tables) on the largest projects. The report contains durations, sizes and
 * memory only; projects are listed by rank, never by id. See scripts/ingestion/README.md.
 *
 *   REHEARSAL_CLICKHOUSE_URL=... REHEARSAL_CLICKHOUSE_USER=... REHEARSAL_CLICKHOUSE_PASSWORD=... \
 *   REHEARSAL_CLICKHOUSE_DB=vemetric bun run rehearsal -- --confirm-copy <hostname of the copy>
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { compareDashboardQueries, formatComparison, loadModels, type QueryComparison } from '../lib/dashboard-queries';
import { checkoutFor, clickhouseQuery, repoRoot, run, workDir } from '../lib/services';

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'confirm-copy': { type: 'string' },
    base: { type: 'string', default: 'main' },
    projects: { type: 'string', default: '3' },
    runs: { type: 'string', default: '3' },
    'skip-migration': { type: 'boolean', default: false },
  },
});

const env = (name: string) => {
  const value = process.env[name];
  if (value === undefined) throw new Error(`Set ${name}`);
  return value;
};
const target = {
  url: env('REHEARSAL_CLICKHOUSE_URL'),
  user: env('REHEARSAL_CLICKHOUSE_USER'),
  password: process.env.REHEARSAL_CLICKHOUSE_PASSWORD ?? '',
  database: process.env.REHEARSAL_CLICKHOUSE_DB ?? 'vemetric',
};
// A deliberate second statement of the target, so production is never used by accident.
if (args['confirm-copy'] !== new URL(target.url).hostname) {
  throw new Error(`Pass --confirm-copy ${new URL(target.url).hostname} to confirm this is a copy, not production`);
}
// Everything below (shared helpers, model code, CLIs) connects to the copy.
Object.assign(process.env, {
  CLICKHOUSE_HOST: target.url,
  CLICKHOUSE_USER: target.user,
  CLICKHOUSE_PASSWORD: target.password,
  CLICKHOUSE_DB: target.database,
  AXIOM_TOKEN: '',
});
const db = target.database;
const report: Record<string, unknown> = { startedAt: new Date().toISOString() };
const timed = async <T>(name: string, fn: () => Promise<T>) => {
  console.log(`\n== ${name}`);
  const started = performance.now();
  const result = await fn();
  const seconds = Math.round((performance.now() - started) / 1000);
  console.log(`   ${name}: ${seconds}s`);
  report.durationsSeconds ??= {} as Record<string, number>;
  (report.durationsSeconds as Record<string, number>)[name] = seconds;
  return result;
};

report.tablesBefore = await clickhouseQuery(
  db,
  `SELECT name, engine, total_rows, formatReadableSize(total_bytes) AS size FROM system.tables
   WHERE database = currentDatabase() AND name IN ('session', 'device', 'event', 'user', 'session_v3', 'device_v2')`,
);
console.log('Tables before:', JSON.stringify(report.tablesBefore));

if (!args['skip-migration']) {
  await timed('migration 15', () =>
    run(['bunx', 'clickhouse-migrations', 'migrate', '--migrations-home=./migrations'], {
      cwd: join(repoRoot, 'packages/clickhouse'),
      env: {
        ...(process.env as Record<string, string>),
        CH_MIGRATIONS_HOST: target.url,
        CH_MIGRATIONS_USER: target.user,
        CH_MIGRATIONS_PASSWORD: target.password,
        CH_MIGRATIONS_DB: target.database,
      },
    }),
  );
  await timed('backfill incl. verification', () =>
    run(['bun', 'src/scripts/backfill-ingestion.ts', '--writers-stopped'], {
      cwd: join(repoRoot, 'packages/clickhouse'),
      env: process.env as Record<string, string>,
    }),
  );
}

report.tablesAfter = await clickhouseQuery(
  db,
  `SELECT name, total_rows, formatReadableSize(total_bytes) AS size FROM system.tables
   WHERE database = currentDatabase() AND name IN ('session', 'device', 'session_v3', 'device_v2')`,
);

// Largest projects by sessions in the last 30 days; their ids stay in this process.
const projects = await clickhouseQuery<{ projectId: string; sessions: number; userId: string }>(
  db,
  `SELECT toString(projectId) AS projectId, uniq(id) AS sessions,
     toString(topK(1)(userId)[1]) AS userId
   FROM session_v3 WHERE startedAt >= now() - INTERVAL 30 DAY AND deleted = 0
   GROUP BY projectId ORDER BY sessions DESC LIMIT ${Number(args.projects)}`,
);
const base = await loadModels(await checkoutFor(args.base), db);
const head = await loadModels(repoRoot, db);
const comparisons: Array<{ rank: number; sessions30Days: number; queries: QueryComparison[] }> = [];
for (const [index, project] of projects.entries()) {
  const queries = await timed(`queries, project #${index + 1} (${project.sessions} sessions in 30 days)`, () =>
    compareDashboardQueries({
      base,
      head,
      database: db,
      projectId: BigInt(project.projectId),
      userId: BigInt(project.userId),
      runs: Number(args.runs),
    }),
  );
  console.log(formatComparison(queries, args.base));
  comparisons.push({ rank: index + 1, sessions30Days: project.sessions, queries });
}
report.queryComparisons = comparisons;

const file = join(workDir, `rehearsal-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`\nReport (no customer data): ${file}`);
process.exit(0);
