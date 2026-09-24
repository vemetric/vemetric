/* eslint-disable no-console */
/**
 * Local ingestion load test: starts a hub and N worker processes of a checkout against disposable
 * databases, sends traffic over HTTP at a fixed rate, and reports throughput, backlog, Redis
 * memory and whether the stored data matches what was sent. See scripts/ingestion/README.md.
 *
 *   bun run loadtest -- [--rate 500] [--duration 60] [--workers 1] [--unique 0.5] [--ref .]
 */
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import {
  checkoutFor,
  childEnv,
  clickhouseQuery,
  createProject,
  recreateDatabases,
  toolsRedisUrl,
  workDir,
} from '../lib/services';

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    ref: { type: 'string', default: '.' },
    rate: { type: 'string', default: '500' },
    duration: { type: 'string', default: '60' },
    workers: { type: 'string', default: '1' },
    unique: { type: 'string', default: '0.5' },
    'drain-timeout': { type: 'string', default: '600' },
  },
});
const rate = Number(args.rate);
const duration = Number(args.duration);
const workerCount = Number(args.workers);
// Share of events from identities that send one event only (bot-like traffic, nothing to reuse).
const uniqueShare = Number(args.unique);

const PROJECT = { id: '9930000000000001', token: 'loadtest-token', domain: 'loadtest.example.com' };
const HUB_PORT = 4004;
const PAGEVIEWS_PER_VISITOR = 5;
const QUEUES = ['event', 'session', 'create-device'];
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
];
const REFERRERS = ['https://www.google.com/', 'https://news.ycombinator.com/', 'https://x.com/', ''];
const PATHS = ['/', '/pricing', '/leaderboard', '/about', '/blog/launch', '/docs'];

const reportDir = join(workDir, `loadtest-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(reportDir, { recursive: true });

// --- Setup -----------------------------------------------------------------------------------
const checkout = await checkoutFor(args.ref);
console.log(`Preparing databases for ${args.ref} ...`);
const { clickhouseDb, databaseUrl } = await recreateDatabases('vm_loadtest_run', checkout);
await createProject('vm_loadtest_run', PROJECT);
const redisUrl = toolsRedisUrl(3);
const redis = new Redis(redisUrl);
await redis.flushdb();
const env = childEnv({ CLICKHOUSE_DB: clickhouseDb, DATABASE_URL: databaseUrl, REDIS_URL: redisUrl });

const processes: Array<ReturnType<typeof Bun.spawn>> = [];
function start(name: string, cwd: string, extraEnv: Record<string, string> = {}) {
  const log = openSync(join(reportDir, `${name}.log`), 'w');
  processes.push(
    Bun.spawn(['bun', 'run', 'src/index.ts'], { cwd, env: { ...env, ...extraEnv }, stdout: log, stderr: log }),
  );
}
async function stopAll() {
  for (const proc of processes) proc.kill('SIGTERM');
  await Promise.race([Promise.all(processes.map((proc) => proc.exited)), Bun.sleep(15_000)]);
  for (const proc of processes) proc.kill('SIGKILL');
}
process.on('SIGINT', async () => {
  await stopAll();
  process.exit(130);
});

async function waitUntilUp(url: string) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await Bun.sleep(500);
  }
  throw new Error(`${url} did not become ready; see logs in ${reportDir}`);
}

start('hub', join(checkout, 'apps/hub'));
for (let i = 0; i < workerCount; i++) {
  start(`worker-${i}`, join(checkout, 'apps/worker'), { WORKER_HEALTH_PORT: String(4101 + i) });
}
await waitUntilUp(`http://localhost:${HUB_PORT}/up`);
for (let i = 0; i < workerCount; i++) await waitUntilUp(`http://localhost:${4101 + i}/up`);
console.log(`Hub and ${workerCount} worker process(es) running; logs in ${reportDir}`);

// --- Traffic ---------------------------------------------------------------------------------
let identitySequence = 0;
function newIdentity() {
  const n = ++identitySequence;
  return {
    ip: `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`,
    userAgent: USER_AGENTS[n % USER_AGENTS.length]!,
    referrer: REFERRERS[n % REFERRERS.length]!,
    sent: 0,
    accepted: 0,
    lastSentAt: 0,
  };
}
type Identity = ReturnType<typeof newIdentity>;
const visitors: Identity[] = [];

const stats = {
  sent: 0,
  accepted: 0,
  identities: 0,
  pageLeaves: 0,
  failed: 0,
  inFlight: 0,
  skipped: 0,
  latencies: [] as number[],
};
const MAX_IN_FLIGHT = 1000;

async function send(path: '/e' | '/l', identity: Identity, body: Record<string, unknown>) {
  if (stats.inFlight >= MAX_IN_FLIGHT) {
    stats.skipped++;
    return;
  }
  stats.inFlight++;
  stats.sent++;
  const started = performance.now();
  try {
    const response = await fetch(`http://localhost:${HUB_PORT}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        token: PROJECT.token,
        'allow-cookies': 'false',
        'user-agent': identity.userAgent,
        'x-forwarded-for': identity.ip,
        ...(identity.sent === 0 && identity.referrer ? { 'v-referrer': identity.referrer } : {}),
      },
      body: JSON.stringify(body),
    });
    await response.arrayBuffer();
    if (response.ok && path === '/e') {
      stats.accepted++;
      if (identity.accepted++ === 0) stats.identities++;
    } else if (response.ok) stats.pageLeaves++;
    else stats.failed++;
  } catch {
    stats.failed++;
  } finally {
    stats.inFlight--;
    stats.latencies.push(performance.now() - started);
  }
}

function sendOne() {
  let identity: Identity;
  if (Math.random() < uniqueShare) {
    identity = newIdentity();
  } else {
    // Returning visitors send several pageviews over time, which exercises session updates. Like a
    // browser, a visitor sends at most one pageview per second: the event table keys rows by
    // (projectId, userId, createdAt), so same-millisecond events of one user collapse into one.
    const candidate = visitors[Math.floor(Math.random() * visitors.length)];
    if (!candidate || Date.now() - candidate.lastSentAt < 1000 || Math.random() < 1 / PAGEVIEWS_PER_VISITOR) {
      identity = newIdentity();
      visitors.push(identity);
    } else {
      identity = candidate;
    }
  }
  const url = `https://${PROJECT.domain}${PATHS[(identity.sent + identitySequence) % PATHS.length]}`;
  void send('/e', identity, { name: '$$pageView', url });
  identity.sent++;
  identity.lastSentAt = Date.now();
  if (identity.sent >= PAGEVIEWS_PER_VISITOR) {
    visitors.splice(visitors.indexOf(identity), 1);
    void send('/l', identity, {});
  }
}

// --- Sampling --------------------------------------------------------------------------------
const queues = QUEUES.map((name) => new Queue(name, { connection: { url: redisUrl } }));
const samples: Array<Record<string, number>> = [];
const testStart = performance.now();
async function sample(phase: string) {
  const counts = await Promise.all(queues.map((queue) => queue.getJobCounts('waiting', 'active', 'delayed')));
  const memory = Number(/used_memory:(\d+)/.exec(await redis.info('memory'))?.[1] ?? 0);
  const row: Record<string, number> = {
    t: Math.round((performance.now() - testStart) / 1000),
    accepted: stats.accepted,
    redisMb: Math.round(memory / 1e6),
    dirtySessions: await redis.zcard('vm:{session-state}:dirty'),
  };
  QUEUES.forEach((name, i) => (row[`${name}Backlog`] = Object.values(counts[i]!).reduce((a, b) => a + b, 0)));
  samples.push(row);
  const previous = samples.at(-2);
  const acceptedRate = previous ? Math.round((row.accepted! - previous.accepted!) / (row.t! - previous.t! || 1)) : 0;
  console.log(
    `${phase.padEnd(5)} t=${String(row.t).padStart(4)}s accepted=${row.accepted} (${acceptedRate}/s) backlog event=${row.eventBacklog} session=${row.sessionBacklog} device=${row['create-deviceBacklog']} dirty=${row.dirtySessions} redis=${row.redisMb}MB`,
  );
  return row;
}

console.log(`Sending ${rate} events/s for ${duration}s (${Math.round(uniqueShare * 100)}% one-off identities)`);
const sendStart = performance.now();
let due = 0;
const ticker = setInterval(() => {
  const elapsed = (performance.now() - sendStart) / 1000;
  const target = Math.floor(Math.min(elapsed, duration) * rate);
  for (; due < target; due++) sendOne();
}, 10);
const sampler = setInterval(() => void sample('load'), 5000);
await Bun.sleep(duration * 1000);
clearInterval(ticker);
clearInterval(sampler);
while (stats.inFlight > 0) await Bun.sleep(50);
const sendSeconds = (performance.now() - sendStart) / 1000;

// --- Drain -----------------------------------------------------------------------------------
const drainStart = performance.now();
let drained = false;
while ((performance.now() - drainStart) / 1000 < Number(args['drain-timeout'])) {
  const row = await sample('drain');
  if (QUEUES.every((name) => row[`${name}Backlog`] === 0) && row.dirtySessions === 0) {
    drained = true;
    break;
  }
  await Bun.sleep(5000);
}
const drainSeconds = (performance.now() - drainStart) / 1000;
await stopAll();
await Promise.all(queues.map((queue) => queue.close()));
await redis.quit();

// --- Verification ----------------------------------------------------------------------------
const tables = new Set(
  (
    await clickhouseQuery<{ name: string }>(
      clickhouseDb,
      'SELECT name FROM system.tables WHERE database = currentDatabase()',
    )
  ).map((t) => t.name),
);
const one = async (query: string) =>
  Number(Object.values((await clickhouseQuery<Record<string, number>>(clickhouseDb, query))[0] ?? {})[0] ?? 0);
const projectFilter = `projectId = ${PROJECT.id}`;
const stored = {
  events: await one(`SELECT sum(sign) FROM event WHERE ${projectFilter}`),
  sessions: tables.has('session_v3')
    ? await one(
        `SELECT count() FROM (SELECT id, argMax(deleted, revision) AS d FROM session_v3 WHERE ${projectFilter} GROUP BY id) WHERE d = 0`,
      )
    : await one(`SELECT count(DISTINCT id) FROM session FINAL WHERE ${projectFilter} AND deleted = 0`),
  devices: tables.has('device_v2')
    ? await one(
        `SELECT count() FROM (SELECT userId, id, argMax(deleted, revision) AS d FROM device_v2 WHERE ${projectFilter} GROUP BY userId, id) WHERE d = 0`,
      )
    : await one(
        `SELECT count() FROM (SELECT userId, id FROM device WHERE ${projectFilter} GROUP BY userId, id HAVING sum(sign) > 0)`,
      ),
};
// Every identity is one user with one device and, within the test, one session.
const expected = { events: stats.accepted, sessions: stats.identities, devices: stats.identities };

const sorted = [...stats.latencies].sort((a, b) => a - b);
const percentile = (p: number) => Math.round(sorted[Math.floor((sorted.length - 1) * p)] ?? 0);
const max = (key: string) => Math.max(...samples.map((row) => row[key] ?? 0));
const report = {
  ref: args.ref,
  config: { rate, duration, workers: workerCount, uniqueShare },
  hub: {
    acceptedPerSecond: Math.round(stats.accepted / sendSeconds),
    accepted: stats.accepted,
    pageLeaves: stats.pageLeaves,
    failed: stats.failed,
    skippedByGenerator: stats.skipped,
    latencyMs: { p50: percentile(0.5), p99: percentile(0.99) },
  },
  processing: {
    drained,
    drainSecondsAfterLoad: Math.round(drainSeconds),
    maxBacklog: Object.fromEntries(QUEUES.map((name) => [name, max(`${name}Backlog`)])),
    peakRedisMb: max('redisMb'),
  },
  data: { expected, stored, matches: JSON.stringify(expected) === JSON.stringify(stored) },
};
writeFileSync(join(reportDir, 'report.json'), JSON.stringify({ ...report, samples }, null, 2));
console.log(`\n${JSON.stringify(report, null, 2)}\nReport and logs: ${reportDir}`);
if (!drained || !report.data.matches || stats.failed > 0) process.exitCode = 1;
