/* eslint-disable no-console */
/**
 * Dashboard query benchmark on synthetic data: generates legacy session/device/event/user data at
 * a configurable scale, migrates it with the real backfill, then runs the same dashboard queries
 * with the model code of `--base` (legacy tables) and of the current checkout (new tables)
 * against the same database. Reports duration, rows read and peak memory per query.
 * See scripts/ingestion/README.md.
 *
 *   bun run benchmark -- [--sessions 3000000] [--months 3] [--base main] [--runs 3]
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { compareDashboardQueries, formatComparison, loadModels } from '../lib/dashboard-queries';
import { checkoutFor, clickhouseCommand, clickhouseQuery, recreateDatabases, repoRoot } from '../lib/services';

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    base: { type: 'string', default: 'main' },
    sessions: { type: 'string', default: '3000000' },
    months: { type: 'string', default: '3' },
    runs: { type: 'string', default: '3' },
    // Share of all sessions in the largest project, which all queries target.
    'largest-share': { type: 'string', default: '0.7' },
    'reuse-data': { type: 'boolean', default: false },
  },
});
const sessions = Number(args.sessions);
const months = Number(args.months);
const users = Math.max(1, Math.floor(sessions / 3));
const largestPercent = Math.round(Number(args['largest-share']) * 100);
const DB = 'vm_loadtest_benchmark';
const P = '1000000000000000001';
const rangeSeconds = months * 30 * 86400;

// --- Data ------------------------------------------------------------------------------------
// Every user belongs to one project; sessions spread evenly over the range, newest first.
const project = (u: string) => `if(${u} % 100 < ${largestPercent}, ${P}, 2000 + ${u} % 50)`;
const pick = (values: string[], expr: string) =>
  `arrayElement([${values.map((v) => `'${v}'`).join(',')}], 1 + ${expr})`;
const sessionColumns = (n: string) => `
  ${project(`(${n} % ${users})`)} AS projectId,
  cityHash64(${n} % ${users}) AS userId,
  toString(cityHash64('s', ${n})) AS id,
  toDateTime64(now() - intDiv(${n} * ${rangeSeconds}, ${sessions}), 3) AS startedAt,
  ${pick(['AT', 'DE', 'US', 'FR', 'GB'], `${n} % 5`)} AS countryCode,
  ${pick(['Vienna', 'Berlin', 'New York', 'Paris', 'London'], `${n} % 5`)} AS city,
  ${pick(['Google', '', 'Twitter', 'news', 'Bing'], `${n} % 5`)} AS referrer,
  ${pick(['search', 'unknown', 'social', 'unknown', 'search'], `${n} % 5`)} AS referrerType,
  'https://example.com' AS origin,
  concat('/p/', toString(${n} % 200)) AS pathname,
  ${pick(['newsletter', '', '', 'twitter', ''], `${n} % 5`)} AS utmSource`;

async function generate() {
  const checkout = await checkoutFor('.');
  console.log(`Generating ${sessions.toLocaleString()} sessions over ${months} months ...`);
  await recreateDatabases(DB, checkout);
  const started = performance.now();
  // Legacy session rows: 1-4 rows per session, like repeated duration updates before merges.
  await clickhouseCommand(
    `INSERT INTO session (projectId, userId, id, startedAt, endedAt, duration, countryCode, city, referrer, referrerType, origin, pathname, utmSource)
     SELECT projectId, userId, id, startedAt, startedAt + toIntervalSecond(r * 30), r * 30, countryCode, city, referrer, referrerType, origin, pathname, utmSource
     FROM (SELECT ${sessionColumns('number')}, number FROM numbers(${sessions})) ARRAY JOIN range(1 + number % 4) AS r`,
    DB,
  );
  await clickhouseCommand(
    `INSERT INTO event (sign, projectId, userId, sessionId, id, name, createdAt, isPageView, countryCode, city, clientName, osName, deviceType, referrer, referrerType, origin, pathname, utmSource, customData)
     SELECT 1, projectId, userId, id, toString(cityHash64('e', number, k)), if(k = 0, '$$pageView', 'signup'),
       startedAt + toIntervalSecond(k * 20), k < 3, countryCode, city, 'Chrome', 'macOS', 'desktop', referrer, referrerType, origin, pathname, utmSource, '{}'
     FROM (SELECT ${sessionColumns('number')}, number FROM numbers(${sessions})) ARRAY JOIN range(1 + number % 5) AS k`,
    DB,
  );
  await clickhouseCommand(
    `INSERT INTO device (sign, projectId, userId, id, createdAt, osName, osVersion, clientName, clientVersion, clientType, deviceType)
     SELECT 1, ${project('number')}, cityHash64(number), cityHash64('d', number), now64(3) - toIntervalSecond(${rangeSeconds}),
       'macOS', '15', 'Chrome', '128', 'browser', 'desktop'
     FROM numbers(${users})`,
    DB,
  );
  await clickhouseCommand(
    `INSERT INTO user (projectId, id, identifier, displayName, createdAt, updatedAt, initialDeviceId, countryCode, city, customData)
     SELECT ${project('number')}, cityHash64(number), concat('user-', toString(number)), 'User',
       now64(3) - toIntervalSecond(${rangeSeconds}), now64(3) - toIntervalSecond(${rangeSeconds}), cityHash64('d', number), 'AT', 'Vienna', '{}'
     FROM numbers(${users}) WHERE number % 10 = 0`,
    DB,
  );
  console.log(`  legacy data: ${Math.round((performance.now() - started) / 1000)}s`);

  process.env.CLICKHOUSE_DB = DB;
  const { clickhouseClient } = await import(join(repoRoot, 'packages/clickhouse/src/client.ts'));
  const { backfillIngestion } = await import(join(repoRoot, 'packages/clickhouse/src/ingestion-backfill.ts'));
  const backfillStarted = performance.now();
  await backfillIngestion(clickhouseClient, { writersStopped: true });
  console.log(`  backfill incl. verification: ${Math.round((performance.now() - backfillStarted) / 1000)}s`);

  // Live sessions of the last week carry unmerged revisions after the cutover.
  await clickhouseCommand(
    `INSERT INTO session_v3 SELECT * REPLACE (revision + k AS revision, endedAt + toIntervalSecond(k * 10) AS endedAt, duration + k * 10 AS duration)
     FROM session_v3 ARRAY JOIN [1, 2] AS k WHERE startedAt >= now() - INTERVAL 7 DAY`,
    DB,
  );
}

// --- Queries ---------------------------------------------------------------------------------
if (!args['reuse-data']) await generate();
// User 0 belongs to the largest project and has sessions, events and a device.
const userId = BigInt((await clickhouseQuery<{ id: string }>(DB, 'SELECT toString(cityHash64(0)) AS id'))[0]!.id);
const results = await compareDashboardQueries({
  base: await loadModels(await checkoutFor(args.base), DB),
  head: await loadModels(repoRoot, DB),
  database: DB,
  projectId: BigInt(P),
  userId,
  runs: Number(args.runs),
});
console.log(formatComparison(results, args.base));
process.exit(0);
