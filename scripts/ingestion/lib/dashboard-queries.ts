import { join } from 'node:path';
import { clickhouseCommand, clickhouseQuery } from './services';

type Models = Record<string, any>;
type Range = { startDate: Date; endDate: Date };
type Query = (range: Range, timeSpan: string) => Promise<unknown>;

/** The clickhouse package (models and query builders) of a checkout, bound to `database`. */
export async function loadModels(checkout: string, database: string): Promise<Models> {
  process.env.CLICKHOUSE_DB = database;
  return await import(join(checkout, 'packages/clickhouse/src/index.ts'));
}

/** Dashboard and user-profile queries that read sessions or devices, callable on any version. */
function dashboardQueries(m: Models, projectId: bigint, userId: bigint): Record<string, Query> {
  const referrerFilter = {
    filters: [{ type: 'referrer', referrerFilter: { operator: 'is', value: 'Google' } }],
    operator: 'and',
  };
  return {
    visitDurationTimeSeries: (r, timeSpan) =>
      m.clickhouseSession.getVisitDurationTimeSeries(projectId, { ...r, timeSpan, filterQueries: '' }),
    countries: (r) => m.clickhouseSession.getCountryCodes(projectId, { ...r, filterQueries: '' }),
    cities: (r) => m.clickhouseSession.getCities(projectId, { ...r, filterQueries: '' }),
    topReferrers: (r) => m.clickhouseSession.getTopSources(projectId, 'referrer', { ...r, filterQueries: '' }),
    topUtmSources: (r) => m.clickhouseSession.getTopSources(projectId, 'utmSource', { ...r, filterQueries: '' }),
    filterableData: (r) => m.clickhouseEvent.getFilterableData(projectId, r.startDate, r.endDate),
    userList: (r) => m.clickhouseEvent.queryUsers({ projectId, filterQueries: '', ...r }),
    userListFilteredByReferrer: (r) => {
      const { filterQueries } = m.getUserFilterQueries({ filterConfig: referrerFilter, projectId, ...r });
      return m.clickhouseEvent.queryUsers({ projectId, filterQueries, ...r });
    },
    userSessions: () => m.clickhouseSession.findByUserId(projectId, userId),
    userLatestSession: () => m.clickhouseSession.findLatestByUserId(projectId, userId),
    userWithDevice: () => m.clickhouseUser.findById(projectId, userId, true),
    userDevices: () => m.clickhouseDevice.findByUserId(projectId, userId),
  };
}
const isPerUser = (name: string) => name.startsWith('user') && !name.startsWith('userList');

// Queries run one after another, so everything the server logged for this database since the
// start timestamp belongs to the measured call.
async function measure(database: string, fn: () => Promise<unknown>) {
  const [{ now }] = (await clickhouseQuery<{ now: string }>(database, 'SELECT toString(now64(6)) AS now')) as [
    { now: string },
  ];
  const started = performance.now();
  const result = await fn();
  const ms = performance.now() - started;
  await clickhouseCommand('SYSTEM FLUSH LOGS', database);
  const [stats] = await clickhouseQuery<{ memory: number }>(
    database,
    `SELECT max(memory_usage) AS memory FROM system.query_log
     WHERE type = 'QueryFinish' AND current_database = '${database}' AND query_kind = 'Select'
       AND query_start_time_microseconds > toDateTime64('${now}', 6)
       AND query NOT LIKE '%system.query_log%' AND query NOT LIKE '%now64(6)%'`,
  );
  const size = Array.isArray(result) ? result.length : result ? 1 : 0;
  return { ms, memory: Number(stats?.memory ?? 0), size };
}

export interface QueryComparison {
  range: string;
  query: string;
  baseMs: number;
  headMs: number;
  baseMemoryMb: number;
  headMemoryMb: number;
  baseRows: number;
  headRows: number;
}

/** Runs every dashboard query with both versions' model code and returns medians per query. */
export async function compareDashboardQueries(options: {
  base: Models;
  head: Models;
  database: string;
  projectId: bigint;
  userId: bigint;
  runs: number;
}): Promise<QueryComparison[]> {
  const { base, head, database, projectId, userId, runs } = options;
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  const results: QueryComparison[] = [];
  for (const [label, days, timeSpan] of [
    ['30 days', 30, '30days'],
    ['7 days', 7, '7days'],
  ] as const) {
    const range = { startDate: new Date(Date.now() - days * 86400_000), endDate: new Date(Date.now() + 60_000) };
    const baseQueries = dashboardQueries(base, projectId, userId);
    const headQueries = dashboardQueries(head, projectId, userId);
    for (const name of Object.keys(headQueries)) {
      if (label === '7 days' && isPerUser(name)) continue;
      type Measurement = Awaited<ReturnType<typeof measure>>;
      const measured: { base: Measurement[]; head: Measurement[] } = { base: [], head: [] };
      for (let run = 0; run < runs; run++) {
        measured.base.push(await measure(database, () => baseQueries[name]!(range, timeSpan)));
        measured.head.push(await measure(database, () => headQueries[name]!(range, timeSpan)));
      }
      results.push({
        range: isPerUser(name) ? 'per user' : label,
        query: name,
        baseMs: Math.round(median(measured.base.map((m) => m.ms))),
        headMs: Math.round(median(measured.head.map((m) => m.ms))),
        baseMemoryMb: Math.round(median(measured.base.map((m) => m.memory)) / 1e6),
        headMemoryMb: Math.round(median(measured.head.map((m) => m.memory)) / 1e6),
        baseRows: measured.base[0]!.size,
        headRows: measured.head[0]!.size,
      });
    }
  }
  return results;
}

export function formatComparison(results: QueryComparison[], baseLabel: string) {
  const header = ['range', 'query', baseLabel, 'new', 'new/old', 'peak memory', 'result rows'];
  const rows = results.map((r) => [
    r.range,
    r.query,
    `${r.baseMs} ms`,
    `${r.headMs} ms`,
    `${(r.headMs / Math.max(r.baseMs, 1)).toFixed(1)}x`,
    `${r.baseMemoryMb} MB -> ${r.headMemoryMb} MB`,
    `${r.baseRows} / ${r.headRows}`,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)));
  return [header, ...rows].map((row) => row.map((cell, i) => cell.padEnd(widths[i]!)).join('  ')).join('\n');
}
