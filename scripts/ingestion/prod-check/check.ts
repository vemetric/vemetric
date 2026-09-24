/* eslint-disable no-console */
/**
 * Read-only production check before the concurrent-ingestion rollout. Prints settings, versions,
 * table sizes and anonymized volume numbers as JSON; it reads no customer data (no ids, URLs or
 * identifiers) and never writes. See scripts/ingestion/README.md.
 *
 *   PROD_CHECK_CLICKHOUSE_URL=... PROD_CHECK_CLICKHOUSE_USER=... PROD_CHECK_CLICKHOUSE_PASSWORD=... \
 *   PROD_CHECK_CLICKHOUSE_DB=vemetric PROD_CHECK_REDIS_URL=... bun run prod-check
 */
import Redis from 'ioredis';

const env = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Set ${name}`);
  return value;
};

const clickhouse = {
  url: env('PROD_CHECK_CLICKHOUSE_URL'),
  user: env('PROD_CHECK_CLICKHOUSE_USER'),
  password: env('PROD_CHECK_CLICKHOUSE_PASSWORD', ''),
  database: env('PROD_CHECK_CLICKHOUSE_DB', 'vemetric'),
};

// GET requests always run in ClickHouse's read-only mode, independent of the user's grants.
async function query(sql: string) {
  const url = new URL(clickhouse.url);
  url.searchParams.set('query', `${sql} FORMAT JSONEachRow`);
  url.searchParams.set('database', clickhouse.database);
  url.searchParams.set('max_execution_time', '120');
  const started = performance.now();
  const response = await fetch(url, {
    headers: { 'X-ClickHouse-User': clickhouse.user, 'X-ClickHouse-Key': clickhouse.password },
  });
  const text = await response.text();
  const ms = Math.round(performance.now() - started);
  if (!response.ok) return { error: text.trim().split('\n')[0], ms };
  return {
    rows: text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>),
    ms,
  };
}

const clickhouseChecks = {
  version: `SELECT version() AS version`,
  settings: `SELECT name, value, changed FROM system.settings
    WHERE name LIKE 'async_insert%' OR name IN ('wait_for_async_insert', 'insert_deduplicate', 'max_memory_usage',
      'max_execution_time', 'optimize_move_to_prewhere_if_final', 'do_not_merge_across_partitions_select_final')`,
  serverSettings: `SELECT name, value FROM system.server_settings
    WHERE name IN ('max_concurrent_queries', 'max_concurrent_insert_queries', 'max_server_memory_usage')`,
  tables: `SELECT name, engine_full, total_rows, formatReadableSize(total_bytes) AS size
    FROM system.tables WHERE database = currentDatabase() ORDER BY name`,
  migrations: `SELECT version, migration_name FROM _migrations ORDER BY version`,
  disks: `SELECT name, formatReadableSize(free_space) AS free, formatReadableSize(total_space) AS total FROM system.disks`,
  sessionPartitions: `SELECT partition, sum(rows) AS rows, formatReadableSize(sum(bytes_on_disk)) AS size
    FROM system.parts WHERE active AND database = currentDatabase() AND table = 'session' GROUP BY partition ORDER BY partition`,
  // Rows per logical session show how many unmerged revisions the reads aggregate.
  sessionsLast90Days: `SELECT toYYYYMM(startedAt) AS month, count() AS rows, uniq(id) AS sessions
    FROM session WHERE startedAt >= now() - INTERVAL 90 DAY GROUP BY month ORDER BY month`,
  // Anonymized: counts of the ten largest projects, no project ids.
  largestProjectsSessions30Days: `SELECT uniq(id) AS sessions, uniq(userId) AS users FROM session
    WHERE startedAt >= now() - INTERVAL 30 DAY GROUP BY projectId ORDER BY sessions DESC LIMIT 10`,
  largestProjectsEvents30Days: `SELECT count() AS events FROM event
    WHERE createdAt >= now() - INTERVAL 30 DAY GROUP BY projectId ORDER BY events DESC LIMIT 10`,
  busiestDays30Days: `SELECT toDate(createdAt) AS day, count() AS events FROM event
    WHERE createdAt >= now() - INTERVAL 30 DAY GROUP BY day ORDER BY events DESC LIMIT 3`,
  devices: `SELECT count() AS rows, uniq(projectId, userId, id) AS devices FROM device`,
};

const results: Record<string, unknown> = {};
for (const [name, sql] of Object.entries(clickhouseChecks)) {
  console.error(`clickhouse: ${name}`);
  results[`clickhouse.${name}`] = await query(sql);
}

const QUEUES = [
  'event',
  'session',
  'create-device',
  'create-user',
  'update-user',
  'enrich-user',
  'merge-user',
  'email-drip',
  'firstEvent',
  'saltRotation',
];
const redis = new Redis(env('PROD_CHECK_REDIS_URL'), { maxRetriesPerRequest: 1, lazyConnect: true });
try {
  await redis.connect();
  const info = async (section: string, keys: string[]) => {
    const text = await redis.info(section);
    return Object.fromEntries(
      text
        .split('\r\n')
        .map((line) => line.split(':'))
        .filter(([key]) => keys.includes(key!)),
    );
  };
  results['redis.server'] = await info('server', ['redis_version', 'uptime_in_days']);
  results['redis.memory'] = await info('memory', [
    'used_memory_human',
    'used_memory_peak_human',
    'maxmemory_human',
    'maxmemory_policy',
    'total_system_memory_human',
  ]);
  results['redis.persistence'] = await info('persistence', [
    'aof_enabled',
    'aof_last_write_status',
    'rdb_last_bgsave_status',
    'rdb_changes_since_last_save',
  ]);
  results['redis.keyspace'] = await info('keyspace', ['db0', 'db1']);
  results['redis.appendfsync'] = await redis.config('GET', 'appendfsync').catch((err: Error) => err.message);
  results['redis.queues'] = Object.fromEntries(
    await Promise.all(
      QUEUES.map(async (name) => {
        const key = (suffix: string) => `bull:${name}:${suffix}`;
        return [
          name,
          {
            waiting: await redis.llen(key('wait')),
            active: await redis.llen(key('active')),
            delayed: await redis.zcard(key('delayed')),
            failed: await redis.zcard(key('failed')),
            globalConcurrency: await redis.hget(key('meta'), 'concurrency'),
            paused: (await redis.hexists(key('meta'), 'paused')) === 1,
          },
        ];
      }),
    ),
  );
} catch (err) {
  results['redis.error'] = (err as Error).message;
} finally {
  redis.disconnect();
}

console.log(JSON.stringify(results, null, 2));
