/* eslint-disable no-console */
// One-off backfill for the referrer types `none` and `internal` (plans/referrer-type-no-referrer.md, 3.2, 3.3, 3.9).
//
// - visits without a referrer (`unknown` with empty referrer and referrerUrl, the old column default) → `none`
// - `direct` (a page on the project's own domain) → `internal`
// - `unknown` rows whose referrer is a key of the referrer list (entries added after the rows were stored) →
//   the list's type and name
// - renamed list entries (`RENAMED_REFERRERS`, e.g. Twitter → X), imported rows included
// - Pirsch imports: channel names → Vemetric types (`--table=pirsch`)
//
// Run it after the deploy, when the new workers are live. All statements are idempotent.
//
//   bun --env-file=../../.env run src/migrations/backfill-referrer-types.ts                 # print all statements
//   bun --env-file=../../.env run src/migrations/backfill-referrer-types.ts --check         # count rows still to change
//   bun --env-file=../../.env run src/migrations/backfill-referrer-types.ts --table=session_v3 --partition=202406 --execute
//   bun --env-file=../../.env run src/migrations/backfill-referrer-types.ts --table=session_v3 --execute
//
// Order: session_v3, event, user (user only after event is done: new users copy their first pageview from event),
// then pirsch. `--execute` runs one table and waits until its mutation is done.
import type { ClickHouseClient } from '@clickhouse/client-web';
import { createClient } from '@clickhouse/client-web';
import { referrers } from '../consts/referrers';

const TABLES = ['session_v3', 'event', 'user'] as const;
type Table = (typeof TABLES)[number];

const VEMETRIC_TYPES = ['none', 'search', 'social', 'email', 'paid', 'llm', 'unknown', 'internal'];

// Names that changed in the referrer list (`renamedReferrers` in fetch-referrers.ts). Rows typed `unknown` are
// skipped: there the name is a raw ref/utm_source value, not the list name.
const RENAMED_REFERRERS: Record<string, string> = { Twitter: 'X' };

const quote = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const list = (values: string[]) => `[${values.map(quote).join(', ')}]`;

// For `unknown` rows, `referrer` is the key the worker looked up (hostname without www., or the ref/utm_source value).
async function findListKeysStoredAsUnknown(client: ClickHouseClient) {
  const found = new Set<string>();
  for (const table of TABLES) {
    const result = await client.query({
      query: `SELECT DISTINCT referrer FROM ${table} WHERE referrerType = 'unknown' AND referrer <> ''`,
      format: 'JSONEachRow',
    });
    for (const { referrer } of (await result.json()) as Array<{ referrer: string }>) {
      if (Object.prototype.hasOwnProperty.call(referrers, referrer)) {
        found.add(referrer);
      }
    }
  }
  return Array.from(found).sort();
}

const renamedCondition = `(referrer IN (${Object.keys(RENAMED_REFERRERS).map(quote).join(', ')}) AND referrerType <> 'unknown')`;

function getCondition(table: Table, keys: string[]) {
  const listed = keys.length ? ` OR referrer IN (${keys.map(quote).join(', ')})` : '';
  const condition = `(referrerType = 'direct' OR (referrerType = 'unknown' AND ((referrer = '' AND referrerUrl = '')${listed})))`;
  // The importer writes Pirsch's channel names; their types are handled by the Pirsch statement. Renames apply to
  // imported rows too.
  return table === 'user'
    ? `${condition} OR ${renamedCondition}`
    : `(importSource = '' AND ${condition}) OR ${renamedCondition}`;
}

function buildStatement(table: Table, keys: string[], partition?: string) {
  const entries = keys.map((key) => referrers[key as keyof typeof referrers]);
  const types = list(entries.map((entry) => entry.type));
  const names = list(entries.map((entry) => entry.name));
  const keyList = list(keys);

  // transform() doesn't accept empty arrays. A renamed name is never a list key, so the type stays as it is.
  const listedType = keys.length ? `transform(referrer, ${keyList}, ${types}, referrerType)` : 'referrerType';
  const renamed = `${renamedCondition}, transform(referrer, ${list(Object.keys(RENAMED_REFERRERS))}, ${list(Object.values(RENAMED_REFERRERS))}, referrer)`;
  const listedName = keys.length
    ? `,\n      referrerType = 'unknown', transform(referrer, ${keyList}, ${names}, referrer)`
    : '';

  // `referrerUrl = referrerUrl` writes the column in old parts where it isn't materialized yet: there its value
  // is computed from `referrer` (DEFAULT referrer) and would otherwise change with the new name.
  return `ALTER TABLE ${table} UPDATE
    referrerType = multiIf(
      referrerType = 'direct', 'internal',
      referrer = '' AND referrerUrl = '', 'none',
      ${listedType}),
    referrer = multiIf(
      ${renamed}${listedName},
      referrer),
    referrerUrl = referrerUrl${partition ? `\n  IN PARTITION ${quote(partition)}` : ''}
  WHERE ${getCondition(table, keys)}`;
}

// Only one project had a Pirsch import when this was written. Pirsch's "Direct" also contains real sources, so
// the hosts found in production are mapped by Vemetric's list; everything else by channel. (3.3)
const PIRSCH_DIRECT_HOSTS: Array<[string, string]> = [
  ['google.com', 'search'],
  ['google.co.uk', 'search'],
  ['accounts.google.com', 'unknown'],
  ['t.co', 'social'],
  ['l.threads.net', 'social'],
  ['threads.net', 'social'],
  ['l.threads.com', 'social'],
  ['threads.com', 'social'],
  ['com.google.android.gm', 'email'],
  ['bing.com', 'search'],
  ['duckduckgo.com', 'search'],
  ['bsky.app', 'social'],
  ['news.ycombinator.com', 'social'],
  ['github.com', 'social'],
  ['outlook.live.com', 'email'],
  ['reddit.com', 'social'],
  ['ecosia.org', 'search'],
];

function buildPirschStatement(table: 'session_v3' | 'event') {
  return `ALTER TABLE ${table} UPDATE referrerType = multiIf(
    referrer = '' AND referrerUrl = '', 'none',
    referrerType = 'Direct', transform(replaceRegexpOne(domain(referrerUrl), '^www\\\\.', ''),
      ${list(PIRSCH_DIRECT_HOSTS.map(([host]) => host))},
      ${list(PIRSCH_DIRECT_HOSTS.map(([, type]) => type))}, 'unknown'),
    transform(referrerType,
      ['Organic Search', 'Organic Social', 'Organic Video', 'AI', 'Email', 'Referral'],
      ['search', 'social', 'social', 'llm', 'email', 'unknown'], 'unknown'))
  WHERE importSource = 'pirsch' AND referrerType NOT IN (${VEMETRIC_TYPES.map(quote).join(', ')})`;
}

async function waitForMutations(client: ClickHouseClient, table: string) {
  while (true) {
    const result = await client.query({
      query: `SELECT count() AS running, sum(parts_to_do) AS partsToDo, any(latest_fail_reason) AS failReason
        FROM system.mutations WHERE database = currentDatabase() AND table = {table:String} AND is_done = 0`,
      query_params: { table },
      format: 'JSONEachRow',
    });
    const [row] = (await result.json()) as Array<{ running: string; partsToDo: string; failReason: string }>;
    if (Number(row?.running ?? 0) === 0) return;
    console.log(
      `  ${table}: ${row!.partsToDo} parts to do${row!.failReason ? `, last failure: ${row!.failReason}` : ''}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function check(client: ClickHouseClient, keys: string[]) {
  for (const table of TABLES) {
    const result = await client.query({
      query: `SELECT count() AS rows FROM ${table} WHERE ${getCondition(table, keys)}`,
      format: 'JSONEachRow',
    });
    const [{ rows }] = (await result.json()) as Array<{ rows: string }>;
    console.log(`${table}: ${rows} rows still to change`);
  }
  for (const table of ['session_v3', 'event']) {
    const result = await client.query({
      query: `SELECT count() AS rows FROM ${table}
        WHERE importSource = 'pirsch' AND referrerType NOT IN (${VEMETRIC_TYPES.map(quote).join(', ')})`,
      format: 'JSONEachRow',
    });
    const [{ rows }] = (await result.json()) as Array<{ rows: string }>;
    console.log(`${table} (pirsch): ${rows} rows still to change`);
  }
}

async function main() {
  const args = new Map(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(/^--/, '').split('=');
      return [key!, value ?? 'true'] as const;
    }),
  );
  const table = args.get('table');
  const partition = args.get('partition');
  const execute = args.get('execute') === 'true';

  if (table && table !== 'pirsch' && !TABLES.includes(table as Table)) {
    throw new Error(`--table must be one of ${[...TABLES, 'pirsch'].join(', ')}`);
  }
  if (partition && (!table || table === 'user' || table === 'pirsch')) {
    throw new Error('--partition only works with --table=session_v3 or --table=event');
  }
  if (execute && !table) {
    throw new Error('--execute needs --table: run one table at a time (session_v3, event, user, pirsch)');
  }

  const client = createClient({
    database: process.env.CH_MIGRATIONS_DB ?? 'vemetric',
    url: process.env.CH_MIGRATIONS_HOST ?? 'http://localhost:8123',
    username: process.env.CH_MIGRATIONS_USER ?? 'default',
    password: process.env.CH_MIGRATIONS_PASSWORD ?? '',
    request_timeout: 300_000,
    clickhouse_settings: { send_progress_in_http_headers: 1, http_headers_progress_interval_ms: '60000' },
  });

  try {
    const keys = await findListKeysStoredAsUnknown(client);
    console.log(`List keys stored as unknown: ${keys.length ? keys.join(', ') : '(none)'}\n`);

    if (args.get('check') === 'true') {
      await check(client, keys);
      return;
    }

    const statements: Array<{ table: string; sql: string }> = [];
    for (const t of TABLES) {
      if (!table || table === t) statements.push({ table: t, sql: buildStatement(t, keys, partition) });
    }
    if (!table || table === 'pirsch') {
      statements.push({ table: 'session_v3', sql: buildPirschStatement('session_v3') });
      statements.push({ table: 'event', sql: buildPirschStatement('event') });
    }

    for (const { table: t, sql } of statements) {
      console.log(`${sql};\n`);
      if (!execute) continue;

      const startedAt = Date.now();
      await client.command({ query: sql });
      await waitForMutations(client, t);
      console.log(`  ${t}: done in ${((Date.now() - startedAt) / 1000).toFixed(1)} s\n`);
    }

    if (!execute) {
      console.log('Dry run: nothing was changed. Add --table=… --execute to run a statement.');
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
