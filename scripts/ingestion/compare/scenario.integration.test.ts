/**
 * Ingestion comparison scenario, run by `compare-refs.ts` inside the hub of each checked-out code
 * version (it is copied to apps/hub/tests and removed afterwards). It drives the in-process hub
 * and workers with a fixed traffic script on a controlled clock and writes a normalized snapshot
 * of the resulting analytics state to INGESTION_COMPARE_OUT. Random ids (sessions, events,
 * devices) are replaced by stable labels, so snapshots of different versions can be diffed.
 * It only uses APIs that exist in every compared version.
 */
import { writeFileSync } from 'node:fs';
import { EventNames } from '@vemetric/common/event';
import type { Queue, Worker } from 'bullmq';
import { clickhouseClient, clickhouseDevice, clickhouseEvent, clickhouseSession, clickhouseUser } from 'clickhouse';
import { prismaClient } from 'database';
import Redis from 'ioredis';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('@vemetric/common/request-ip', () => ({ getClientIp: () => '127.0.0.1' }));

const BASE = Date.UTC(2026, 8, 20, 10, 0, 0);
const PROJECT = {
  projectId: '9920000000000001',
  organizationId: 'diff-org',
  token: 'diff-token',
  domain: 'diff.example.com',
};
const UA = {
  desktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
  android:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  server: 'node-fetch/1.0',
};
const ANDROID_HINTS = { 'sec-ch-ua-platform': '"Android"', 'sec-ch-ua-mobile': '?1', 'sec-ch-ua-model': '"Pixel 8"' };
const burstUa = (i: number) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/12${i}.0.0.0 Safari/537.36`;

let hubFetch: (request: Request) => Promise<Response>;
const workers: Worker[] = [];
let queues: Queue[] = [];
let redis: Redis;
let ingestion: { flushSessionBuffer: () => Promise<number>; closeStateRedis: () => Promise<void> } | null = null;

const at = (seconds: number) => vi.setSystemTime(BASE + seconds * 1000);

async function send(path: '/e' | '/i' | '/l', userAgent: string, body: Record<string, unknown>, extra = {}) {
  const response = await hubFetch(
    new Request(`http://hub.test${path}`, {
      method: 'POST',
      headers: new Headers({
        'content-type': 'application/json',
        token: PROJECT.token,
        'allow-cookies': 'false',
        'user-agent': userAgent,
        'v-sdk': 'integration-test',
        ...extra,
      }),
      body: JSON.stringify(body),
    }),
  );
  expect(response.status, `${path} ${JSON.stringify(body)}`).toBe(200);
}
const pageView = (ua: string, url: string, extra: Record<string, unknown> = {}, headers = {}) =>
  send('/e', ua, { name: EventNames.PageView, url, ...extra }, headers);

async function idle() {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    const counts = await Promise.all(
      queues.map((queue) => queue.getJobCounts('waiting', 'active', 'delayed', 'prioritized', 'paused')),
    );
    if (counts.every((count) => Object.values(count).every((value) => value === 0))) {
      if (!ingestion) return;
      await ingestion.flushSessionBuffer();
      if ((await redis.zcard('vm:{session-state}:dirty')) === 0) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('queues did not become idle');
}

async function expireHubSessions() {
  const keys = await redis.keys('sessionid:*');
  if (keys.length) await redis.del(...keys);
}

// Seconds since the scenario start. Every scripted step starts on a whole second; the clock keeps
// running in real time, so sub-second parts are processing jitter and are rounded away.
const offset = (value: string) =>
  Math.round((Date.parse(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z')) - BASE) / 1000);

describe('ingestion comparison scenario', () => {
  afterAll(async () => {
    await Promise.all(workers.map((worker) => worker.close()));
    await redis?.quit();
    await ingestion?.closeStateRedis();
    await prismaClient.$disconnect();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('produces a snapshot', async () => {
    const redisUrl = process.env.REDIS_URL!;
    vi.stubGlobal('Bun', {
      readableStreamToText: async (stream: ReadableStream) => await new Response(stream).text(),
    });
    redis = new Redis(redisUrl);
    await redis.flushdb();

    for (const table of ['event', 'session', 'user', 'device', 'session_v3', 'device_v2']) {
      await clickhouseClient.command({ query: `TRUNCATE TABLE IF EXISTS ${table}` });
    }
    await prismaClient.userIdentificationMap.deleteMany({ where: { projectId: PROJECT.projectId } });
    await prismaClient.project.deleteMany({ where: { id: PROJECT.projectId } });
    await prismaClient.organization.deleteMany({ where: { id: PROJECT.organizationId } });
    await prismaClient.organization.create({ data: { id: PROJECT.organizationId, name: 'Diff' } });
    await prismaClient.project.create({
      data: {
        id: PROJECT.projectId,
        organizationId: PROJECT.organizationId,
        name: 'Diff',
        domain: PROJECT.domain,
        token: PROJECT.token,
      },
    });

    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    at(-60);

    ingestion = await import('../../worker/src/ingestion').catch(() => null);
    const hub = await import('../src/index');
    hubFetch = async (request) => await hub.default.fetch(request);
    const w = {
      event: (await import('../../worker/src/workers/event-worker')).initEventWorker,
      session: (await import('../../worker/src/workers/session-worker')).initSessionWorker,
      device: (await import('../../worker/src/workers/device-worker')).initDeviceWorker,
      createUser: (await import('../../worker/src/workers/create-user-worker')).initCreateUserWorker,
      updateUser: (await import('../../worker/src/workers/update-user-worker')).initUpdateUserWorker,
      enrichUser: (await import('../../worker/src/workers/enrich-user-worker')).initEnrichUserWorker,
      mergeUser: (await import('../../worker/src/workers/merge-user-worker')).initMergeUserWorker,
    };
    const replicas = Number(process.env.INGESTION_COMPARE_REPLICAS ?? 1);
    for (let replica = 0; replica < replicas; replica++) {
      workers.push(...(await Promise.all(Object.values(w).map((init) => init()))));
    }
    queues = [
      (await import('@vemetric/queues/event-queue')).eventQueue,
      (await import('@vemetric/queues/session-queue')).sessionQueue,
      (await import('@vemetric/queues/create-device-queue')).createDeviceQueue,
      (await import('@vemetric/queues/create-user-queue')).createUserQueue,
      (await import('@vemetric/queues/update-user-queue')).updateUserQueue,
      (await import('@vemetric/queues/enrich-user-queue')).enrichUserQueue,
      (await import('@vemetric/queues/merge-user-queue')).mergeUserQueue,
    ];

    // Phase 1: anonymous sessions from several devices, referrers, UTM tags, custom and server events.
    at(0);
    await pageView(
      UA.desktop,
      'https://diff.example.com/landing?utm_source=news&utm_medium=email&utm_campaign=fall',
      {},
      {
        'v-referrer': 'https://news.ycombinator.com/item?id=1',
      },
    );
    at(5);
    await pageView(UA.iphone, 'https://diff.example.com/', {}, { 'v-referrer': 'https://www.google.com/' });
    at(10);
    await pageView(UA.android, 'https://diff.example.com/docs', {}, ANDROID_HINTS);
    at(15);
    await send('/e', UA.server, { name: 'webhook_received', customData: { source: 'stripe' } });
    at(20);
    await pageView(UA.desktop, 'https://diff.example.com/pricing');
    at(30);
    await pageView(UA.firefox, 'https://diff.example.com/pricing?ref=producthunt');
    at(40);
    await send('/e', UA.desktop, {
      name: 'signup_click',
      url: 'https://diff.example.com/pricing',
      customData: { plan: 'pro' },
    });
    at(45);
    await pageView(UA.android, 'https://diff.example.com/docs/setup', {}, ANDROID_HINTS);
    at(65);
    await pageView(UA.iphone, 'https://diff.example.com/blog/post-1');
    at(70);
    await send('/l', UA.desktop, {});
    at(90);
    await send('/l', UA.android, {}, ANDROID_HINTS);
    await idle();

    // Phase 2: identification of a new user, then a merge of another device into that user.
    at(120);
    await send('/i', UA.iphone, { identifier: 'alice', displayName: 'Alice' });
    await idle();
    at(130);
    await pageView(UA.iphone, 'https://diff.example.com/account', { identifier: 'alice' });
    await idle();
    at(200);
    await send('/i', UA.firefox, { identifier: 'alice', displayName: 'Alice A.' });
    at(210);
    await pageView(UA.firefox, 'https://diff.example.com/account/settings', { identifier: 'alice' });
    await idle();

    // Phase 3: new sessions after inactivity, server-side event for an identified user.
    await expireHubSessions();
    at(3600);
    await pageView(UA.desktop, 'https://diff.example.com/landing', {}, { 'v-referrer': 'https://twitter.com/someone' });
    at(3610);
    await send('/e', UA.server, { name: 'invoice_paid', identifier: 'alice', customData: { amount: 10 } });
    at(3650);
    await pageView(UA.desktop, 'https://diff.example.com/features?utm_source=twitter');
    at(3700);
    await send('/l', UA.desktop, {});
    await idle();

    // Phase 4: a burst of concurrent visitors, each with several pageviews.
    for (let round = 0; round < 4; round++) {
      at(7200 + round * 15);
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          pageView(
            burstUa(i),
            `https://diff.example.com/burst/${i}/${round}`,
            {},
            round === 0 && i % 2 === 0 ? { 'v-referrer': 'https://www.bing.com/' } : {},
          ),
        ),
      );
    }
    at(7300);
    await Promise.all(Array.from({ length: 10 }, (_, i) => send('/l', burstUa(i), {})));
    await idle();
    vi.useRealTimers();
    // Compare the settled state: reads without FINAL depend on when ClickHouse merges parts in
    // the background, which differs between runs, not between versions.
    const existing = (await (
      await clickhouseClient.query({
        query: `SELECT name FROM system.tables WHERE database = currentDatabase()
          AND name IN ('event', 'session', 'session_v3', 'device', 'device_v2')`,
        format: 'JSONEachRow',
      })
    ).json()) as Array<{ name: string }>;
    for (const { name } of existing) await clickhouseClient.command({ query: `OPTIMIZE TABLE ${name} FINAL` });

    // Snapshot
    const projectId = BigInt(PROJECT.projectId);
    const events = (await (
      await clickhouseClient.query({
        query: `SELECT * FROM event FINAL WHERE projectId = ${projectId} AND sign = 1 ORDER BY createdAt, name`,
        format: 'JSONEachRow',
      })
    ).json()) as Array<Record<string, any>>;
    const userIds = Array.from(new Set(events.map((e) => String(e.userId))));
    const users = new Map<string, string>();
    for (const userId of userIds) {
      const user = await clickhouseUser.findById(projectId, BigInt(userId));
      const firstUa = events.find((e) => String(e.userId) === userId)!.userAgent;
      users.set(userId, user?.identifier ? `id:${user.identifier}` : `ua:${firstUa}`);
    }
    const userLabel = (id: unknown) => users.get(String(id)) ?? `unknown:${id}`;

    const sessionLabels = new Map<string, string>();
    const sessions: unknown[] = [];
    const devices: unknown[] = [];
    const userRows: unknown[] = [];
    for (const [userId, label] of users) {
      for (const s of await clickhouseSession.findByUserId(projectId, BigInt(userId))) {
        const sessionLabel = `${label}@${offset(s.startedAt)}`;
        sessionLabels.set(s.id, sessionLabel);
        const { id: _id, projectId: _p, userId: _u, startedAt, endedAt, deleted: _d, ...rest } = s as any;
        sessions.push({
          session: sessionLabel,
          user: label,
          startedAt: offset(startedAt),
          endedAt: offset(endedAt),
          ...rest,
        });
      }
      for (const d of await clickhouseDevice.findByUserId(projectId, BigInt(userId))) {
        const { id: _id, projectId: _p, userId: _u, createdAt: _c, deleted: _d, ...rest } = d as any;
        devices.push({ user: label, ...rest });
      }
      const user = await clickhouseUser.findById(projectId, BigInt(userId), true);
      if (user) {
        const { id: _id, projectId: _p, initialDeviceId: _i, createdAt, updatedAt, firstSeenAt, ...rest } = user as any;
        userRows.push({
          user: label,
          createdAt: offset(createdAt),
          updatedAt: offset(updatedAt),
          firstSeenAt: offset(firstSeenAt),
          ...rest,
        });
      }
    }
    const eventRows = events.map((e) => {
      const { id: _id, projectId: _p, userId, sessionId, deviceId: _d, createdAt, sign: _s, ...rest } = e;
      return {
        user: userLabel(userId),
        session: sessionLabels.get(sessionId) ?? `missing:${sessionId ? 'set' : ''}`,
        createdAt: offset(createdAt),
        ...rest,
      };
    });

    const range = { startDate: new Date(BASE - 3600_000), endDate: new Date(BASE + 3 * 3600_000) };
    const opts = { ...range, filterQueries: '', filterConfig: undefined, timeSpan: '24hrs' } as any;
    const dashboards = {
      visitDuration: await clickhouseSession.getVisitDurationTimeSeries(projectId, opts),
      countries: await clickhouseSession.getCountryCodes(projectId, opts),
      cities: await clickhouseSession.getCities(projectId, opts),
      sources: Object.fromEntries(
        await Promise.all(
          (['referrer', 'referrerType', 'referrerUrl', 'utmSource', 'utmMedium', 'utmCampaign'] as const).map(
            async (source) => [
              source,
              // Other columns of this query are any() picks and therefore arbitrary.
              (await clickhouseSession.getTopSources(projectId, source, opts))
                .map((row: any) => [row[source], row.users])
                .sort(),
            ],
          ),
        ),
      ),
      activeUsers: await clickhouseEvent.getActiveUsers(projectId, range),
      pages: await clickhouseEvent.getMostVisitedPages(projectId, opts),
      browsers: await clickhouseEvent.getBrowsers(projectId, opts),
      devices: await clickhouseEvent.getDevices(projectId, opts),
      os: await clickhouseEvent.getOperatingSystems(projectId, opts),
      bounce: await clickhouseEvent.getBounceRateTimeSeries(projectId, opts),
      pageViews: await clickhouseEvent.getPageViewTimeSeries(projectId, opts),
      filterable: await clickhouseEvent.getFilterableData(projectId, range.startDate, range.endDate),
    };

    const sortKey = (value: unknown) => JSON.stringify(value);
    const sortRows = (rows: unknown[]) => [...rows].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
    const snapshot = {
      sessions: sortRows(sessions),
      devices: sortRows(devices),
      users: sortRows(userRows),
      events: sortRows(eventRows),
      dashboards,
    };
    // null and missing are treated alike; arrays of plain values come from unordered aggregations.
    const normalize = (_key: string, value: unknown) => {
      if (typeof value === 'bigint') return String(value);
      if (Array.isArray(value) && value.every((item) => item === null || typeof item !== 'object')) {
        return [...value].sort();
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));
      }
      return value;
    };
    writeFileSync(process.env.INGESTION_COMPARE_OUT!, JSON.stringify(snapshot, normalize, 2));
  }, 180_000);
});
