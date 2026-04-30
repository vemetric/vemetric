import { EventNames } from '@vemetric/common/event';
import type { FunnelStep } from '@vemetric/common/funnel';
import type { Queue, Worker } from 'bullmq';
import { clickhouseClient, clickhouseDevice, clickhouseEvent, clickhouseSession, clickhouseUser } from 'clickhouse';
import { dbFunnel, prismaClient } from 'database';
import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vemetric/common/request-ip', () => ({
  getClientIp: () => '127.0.0.1',
}));

const TEST_USER_AGENT = 'VemetricIntegrationTests/1.0';

type ProjectContext = {
  projectId: string;
  organizationId: string;
  token: string;
  domain: string;
};

type HubRuntime = {
  fetch: (request: Request) => Promise<Response>;
  workers: Worker[];
  queues: Array<Queue>;
  redis: Redis;
};

let runtime: HubRuntime | null = null;
let projectSequence = 0;

function getTestRedisUrl() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL must be set for hub integration tests.');
  }

  return `${redisUrl.replace(/\/$/, '')}/15`;
}

function nextProjectContext(): ProjectContext {
  projectSequence += 1;
  const projectId = `9910000000000${String(projectSequence).padStart(3, '0')}`;
  return {
    projectId,
    organizationId: `ingestion-test-org-${projectId}`,
    token: `ingestion-token-${projectId}`,
    domain: `ingestion-${projectId}.example.com`,
  };
}

async function waitFor(description: string, predicate: () => Promise<boolean>, timeoutMs = 10000, intervalMs = 100) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (lastError instanceof Error) {
    throw new Error(`${description} failed: ${lastError.message}`);
  }

  throw new Error(`Timed out waiting for ${description}`);
}

async function waitForStable(
  description: string,
  predicate: () => Promise<boolean>,
  timeoutMs = 10000,
  intervalMs = 250,
  requiredSuccesses = 3,
) {
  let successes = 0;

  await waitFor(
    description,
    async () => {
      if (await predicate()) {
        successes += 1;
      } else {
        successes = 0;
      }

      return successes >= requiredSuccesses;
    },
    timeoutMs,
    intervalMs,
  );
}

async function createProject(context: ProjectContext) {
  await prismaClient.userIdentificationMap.deleteMany({ where: { projectId: context.projectId } });
  await prismaClient.project.deleteMany({ where: { id: context.projectId } });
  await prismaClient.organization.deleteMany({ where: { id: context.organizationId } });

  await prismaClient.organization.create({
    data: {
      id: context.organizationId,
      name: `Ingestion Test ${context.projectId}`,
    },
  });

  await prismaClient.project.create({
    data: {
      id: context.projectId,
      organizationId: context.organizationId,
      name: `Ingestion Test ${context.projectId}`,
      domain: context.domain,
      token: context.token,
    },
  });
}

async function cleanupProject(context: ProjectContext) {
  await waitForQueuesIdle(30000);
  await prismaClient.userIdentificationMap.deleteMany({ where: { projectId: context.projectId } });
  await prismaClient.project.deleteMany({ where: { id: context.projectId } });
  await prismaClient.organization.deleteMany({ where: { id: context.organizationId } });
  await cleanupClickHouse(context.projectId);
}

async function cleanupClickHouse(projectId: string) {
  for (const table of ['event', 'session', 'user', 'device']) {
    await clickhouseClient.command({
      query: `ALTER TABLE ${table} DELETE WHERE projectId = {projectId:UInt64} SETTINGS mutations_sync = 2`,
      query_params: { projectId },
    });
  }
}

async function flushRedis() {
  if (!runtime) {
    throw new Error('Test runtime not initialized');
  }

  await runtime.redis.flushdb();
}

async function waitForQueuesIdle(timeoutMs = 10000) {
  if (!runtime) {
    throw new Error('Test runtime not initialized');
  }

  await waitFor(
    'queues to become idle',
    async () => {
      const counts = await Promise.all(
        runtime!.queues.map((queue) => queue.getJobCounts('waiting', 'active', 'delayed', 'prioritized', 'paused')),
      );

      return counts.every((count) => Object.values(count).every((value) => value === 0));
    },
    timeoutMs,
  );
}

function buildHeaders(project: ProjectContext, headers: Record<string, string> = {}): Headers {
  return new Headers({
    'content-type': 'application/json',
    token: project.token,
    'allow-cookies': 'false',
    'user-agent': TEST_USER_AGENT,
    'v-sdk': 'integration-test',
    ...headers,
  });
}

async function requestHub(
  path: '/e' | '/i',
  project: ProjectContext,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  if (!runtime) {
    throw new Error('Test runtime not initialized');
  }

  return runtime.fetch(
    new Request(`http://hub.test${path}`, {
      method: 'POST',
      headers: buildHeaders(project, headers),
      body: JSON.stringify(body),
    }),
  );
}

async function ingestPageView(
  project: ProjectContext,
  props: {
    url: string;
    identifier?: string;
    displayName?: string;
    userAgent?: string;
    contextId?: string;
  },
) {
  const response = await requestHub(
    '/e',
    project,
    {
      name: EventNames.PageView,
      url: props.url,
      identifier: props.identifier,
      displayName: props.displayName,
      contextId: props.contextId,
    },
    props.userAgent ? { 'user-agent': props.userAgent } : {},
  );

  expect(response.status).toBe(200);
}

async function ingestEvent(
  project: ProjectContext,
  props: {
    name: string;
    url: string;
    identifier?: string;
    displayName?: string;
    contextId?: string;
    customData?: Record<string, unknown>;
  },
) {
  const response = await requestHub('/e', project, {
    name: props.name,
    url: props.url,
    identifier: props.identifier,
    displayName: props.displayName,
    contextId: props.contextId,
    customData: props.customData,
  });

  expect(response.status).toBe(200);
}

async function identifyUser(
  project: ProjectContext,
  identifier: string,
  displayName = identifier,
  headers: Record<string, string> = {},
) {
  const response = await requestHub(
    '/i',
    project,
    {
      identifier,
      displayName,
    },
    headers,
  );

  expect(response.status).toBe(200);
}

function getQueryRange() {
  const endDate = new Date(Date.now() + 60_000);
  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return { startDate, endDate };
}

async function expectActiveUserMetrics(projectId: string, expectedUsers: number) {
  const { startDate, endDate } = getQueryRange();
  const [activeUsers, activeUserTimeSeries] = await Promise.all([
    clickhouseEvent.getActiveUsers(BigInt(projectId), { startDate, endDate }),
    clickhouseEvent.getActiveUserTimeSeries(BigInt(projectId), {
      timeSpan: '24hrs',
      startDate,
      endDate,
      filterQueries: '',
    }),
  ]);

  expect(activeUsers).toBe(expectedUsers);
  expect(activeUserTimeSeries).not.toBeNull();
  expect(activeUserTimeSeries?.reduce((max, row) => Math.max(max, row.count), 0)).toBe(expectedUsers);
}

describe.sequential('hub ingestion integration', () => {
  beforeAll(async () => {
    const testRedisUrl = getTestRedisUrl();
    process.env.REDIS_URL = testRedisUrl;
    vi.stubGlobal('Bun', {
      readableStreamToText: async (stream: ReadableStream) => await new Response(stream).text(),
    });

    const redis = new Redis(testRedisUrl);
    await redis.flushdb();

    const [
      hubModule,
      workerModule,
      eventQueueModule,
      sessionQueueModule,
      deviceQueueModule,
      createUserQueueModule,
      updateUserQueueModule,
      enrichUserQueueModule,
      mergeUserQueueModule,
    ] = await Promise.all([
      import('../src/index'),
      import('../../worker/src/workers/event-worker').then(async (eventWorkerModule) => ({
        initEventWorker: eventWorkerModule.initEventWorker,
        initSessionWorker: (await import('../../worker/src/workers/session-worker')).initSessionWorker,
        initDeviceWorker: (await import('../../worker/src/workers/device-worker')).initDeviceWorker,
        initCreateUserWorker: (await import('../../worker/src/workers/create-user-worker')).initCreateUserWorker,
        initUpdateUserWorker: (await import('../../worker/src/workers/update-user-worker')).initUpdateUserWorker,
        initEnrichUserWorker: (await import('../../worker/src/workers/enrich-user-worker')).initEnrichUserWorker,
        initMergeUserWorker: (await import('../../worker/src/workers/merge-user-worker')).initMergeUserWorker,
      })),
      import('@vemetric/queues/event-queue'),
      import('@vemetric/queues/session-queue'),
      import('@vemetric/queues/create-device-queue'),
      import('@vemetric/queues/create-user-queue'),
      import('@vemetric/queues/update-user-queue'),
      import('@vemetric/queues/enrich-user-queue'),
      import('@vemetric/queues/merge-user-queue'),
    ]);

    const workers = await Promise.all([
      workerModule.initEventWorker(),
      workerModule.initSessionWorker(),
      workerModule.initDeviceWorker(),
      workerModule.initCreateUserWorker(),
      workerModule.initUpdateUserWorker(),
      workerModule.initEnrichUserWorker(),
      workerModule.initMergeUserWorker(),
    ]);

    runtime = {
      fetch: async (request: Request) => await hubModule.default.fetch(request),
      workers,
      redis,
      queues: [
        eventQueueModule.eventQueue,
        sessionQueueModule.sessionQueue,
        deviceQueueModule.createDeviceQueue,
        createUserQueueModule.createUserQueue,
        updateUserQueueModule.updateUserQueue,
        enrichUserQueueModule.enrichUserQueue,
        mergeUserQueueModule.mergeUserQueue,
      ],
    };
  }, 30000);

  beforeEach(async () => {
    await waitForQueuesIdle();
    await flushRedis();
  });

  afterAll(async () => {
    if (!runtime) {
      vi.unstubAllGlobals();
      return;
    }

    await waitForQueuesIdle();
    await flushRedis();
    await Promise.all(runtime.workers.map((worker) => worker.close()));
    await runtime.redis.quit();
    await prismaClient.$disconnect();
    vi.unstubAllGlobals();
  });

  it('ingests anonymous pageviews and creates session/device state', async () => {
    const project = nextProjectContext();
    await createProject(project);

    try {
      await ingestPageView(project, {
        url: `https://${project.domain}/pricing`,
        contextId: 'anon-pageview',
      });

      await waitFor('anonymous event ingestion', async () => {
        const users = await clickhouseEvent.queryUsers({
          projectId: BigInt(project.projectId),
          filterQueries: '',
          ...getQueryRange(),
        });
        return users.length === 1;
      });

      const users = await clickhouseEvent.queryUsers({
        projectId: BigInt(project.projectId),
        filterQueries: '',
        ...getQueryRange(),
      });

      expect(users).toHaveLength(1);
      const anonymousUserId = users[0].id;

      const [events, sessions, devices] = await Promise.all([
        clickhouseEvent.getLatestEventsByUserId({
          projectId: BigInt(project.projectId),
          userId: anonymousUserId,
          limit: 10,
          ...getQueryRange(),
        }),
        clickhouseSession.findByUserId(BigInt(project.projectId), anonymousUserId),
        clickhouseDevice.findByUserId(BigInt(project.projectId), anonymousUserId),
      ]);

      expect(events).toHaveLength(1);
      expect(Boolean(events[0].isPageView)).toBe(true);
      expect(events[0].pathname).toBe('/pricing');
      expect(events[0].userIdentifier).toBe('');
      expect(sessions).toHaveLength(1);
      expect(devices).toHaveLength(1);
      await expectActiveUserMetrics(project.projectId, 1);
    } finally {
      await cleanupProject(project);
    }
  });

  it('ingests identified pageviews under the mapped user and persists the user record', async () => {
    const project = nextProjectContext();
    await createProject(project);

    try {
      await identifyUser(project, 'identified-user', 'Identified User');
      await ingestPageView(project, {
        url: `https://${project.domain}/dashboard`,
        identifier: 'identified-user',
        displayName: 'Identified User',
        contextId: 'identified-pageview',
      });

      await waitFor('identified user record', async () => {
        const user = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'identified-user');
        return user !== null;
      });

      const identifiedUser = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'identified-user');
      expect(identifiedUser).not.toBeNull();

      const events = await clickhouseEvent.getLatestEventsByUserId({
        projectId: BigInt(project.projectId),
        userId: identifiedUser!.id,
        limit: 10,
        ...getQueryRange(),
      });

      expect(events).toHaveLength(1);
      expect(events[0].pathname).toBe('/dashboard');
      expect(events[0].userIdentifier).toBe('identified-user');
      expect(events[0].userDisplayName).toBe('Identified User');
      await expectActiveUserMetrics(project.projectId, 1);
    } finally {
      await cleanupProject(project);
    }
  });

  it('merges anonymous traffic into an existing identified user', async () => {
    const project = nextProjectContext();
    await createProject(project);
    const anonymousUserAgent = `${TEST_USER_AGENT} anonymous`;

    try {
      await identifyUser(project, 'merge-user@example.com', 'Merge User');
      await ingestPageView(project, {
        url: `https://${project.domain}/account`,
        identifier: 'merge-user@example.com',
        displayName: 'Merge User',
        contextId: 'identified-before-merge',
      });

      await waitFor('existing identified user before merge', async () => {
        const user = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'merge-user@example.com');
        return user !== null;
      });

      const existingUser = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'merge-user@example.com');
      expect(existingUser).not.toBeNull();

      await ingestPageView(project, {
        url: `https://${project.domain}/pricing`,
        userAgent: anonymousUserAgent,
        contextId: 'anonymous-before-merge',
      });

      await waitFor('anonymous user before merge', async () => {
        const users = await clickhouseEvent.queryUsers({
          projectId: BigInt(project.projectId),
          filterQueries: '',
          ...getQueryRange(),
        });

        return users.some((user) => user.id !== existingUser!.id);
      });

      const usersBeforeMerge = await clickhouseEvent.queryUsers({
        projectId: BigInt(project.projectId),
        filterQueries: '',
        ...getQueryRange(),
      });
      expect(usersBeforeMerge).toHaveLength(2);
      await expectActiveUserMetrics(project.projectId, 2);
      const anonymousUser = usersBeforeMerge.find((user) => user.id !== existingUser!.id);
      expect(anonymousUser).toBeDefined();

      await identifyUser(project, 'merge-user@example.com', 'Merge User', {
        'user-agent': anonymousUserAgent,
      });
      await waitForQueuesIdle(30000);

      await waitForStable('merged activity after identify', async () => {
        const users = await clickhouseEvent.queryUsers({
          projectId: BigInt(project.projectId),
          filterQueries: '',
          ...getQueryRange(),
        });
        const identifiedEvents = await clickhouseEvent.findByUserId(BigInt(project.projectId), existingUser!.id);
        const uniquePathnames = Array.from(new Set(identifiedEvents.map((event) => event.pathname))).sort();

        return (
          users.length === 1 && users[0].id === existingUser!.id && uniquePathnames.join('|') === '/account|/pricing'
        );
      });

      const [identifiedEvents, identifiedSessions, identifiedDevices] = await Promise.all([
        clickhouseEvent.findByUserId(BigInt(project.projectId), existingUser!.id),
        clickhouseSession.findByUserId(BigInt(project.projectId), existingUser!.id),
        clickhouseDevice.findByUserId(BigInt(project.projectId), existingUser!.id),
      ]);

      expect(Array.from(new Set(identifiedEvents.map((event) => event.pathname))).sort()).toEqual([
        '/account',
        '/pricing',
      ]);
      expect(identifiedSessions.length).toBeGreaterThan(0);
      expect(identifiedDevices.length).toBeGreaterThan(0);
      await expectActiveUserMetrics(project.projectId, 1);
    } finally {
      await cleanupProject(project);
    }
  });

  it('does not create duplicate users when an already identified user sends more events', async () => {
    const project = nextProjectContext();
    await createProject(project);

    try {
      await identifyUser(project, 'stable-user', 'Stable User');

      await ingestPageView(project, {
        url: `https://${project.domain}/first`,
        identifier: 'stable-user',
        displayName: 'Stable User',
        contextId: 'stable-user-1',
      });
      await ingestEvent(project, {
        name: 'ClickedCTA',
        url: `https://${project.domain}/first`,
        identifier: 'stable-user',
        displayName: 'Stable User',
        contextId: 'stable-user-2',
      });

      await waitFor('stable user events', async () => {
        const user = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'stable-user');
        if (!user) {
          return false;
        }

        const events = await clickhouseEvent.findByUserId(BigInt(project.projectId), user.id);
        return events.length >= 2;
      });

      const stableUser = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'stable-user');
      expect(stableUser).not.toBeNull();

      const [users, events] = await Promise.all([
        clickhouseEvent.queryUsers({
          projectId: BigInt(project.projectId),
          filterQueries: '',
          ...getQueryRange(),
        }),
        clickhouseEvent.findByUserId(BigInt(project.projectId), stableUser!.id),
      ]);

      expect(users).toHaveLength(1);
      expect(events).toHaveLength(2);
      expect(events.some((event) => event.name === 'ClickedCTA')).toBe(true);
      await expectActiveUserMetrics(project.projectId, 1);
    } finally {
      await cleanupProject(project);
    }
  });

  it('prefers the no-cookie body identifier over fingerprint resolution on later events', async () => {
    const project = nextProjectContext();
    await createProject(project);

    try {
      await identifyUser(project, 'body-identifier-user', 'Body Identifier User');

      await ingestPageView(project, {
        url: `https://${project.domain}/settings`,
        identifier: 'body-identifier-user',
        displayName: 'Body Identifier User',
        userAgent: `${TEST_USER_AGENT} alternate`,
        contextId: 'body-identifier-pageview',
      });

      await waitFor('body identifier event ingestion', async () => {
        const user = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'body-identifier-user');
        if (!user) {
          return false;
        }

        const events = await clickhouseEvent.findByUserId(BigInt(project.projectId), user.id);
        return events.length >= 1;
      });

      const identifiedUser = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'body-identifier-user');
      const users = await clickhouseEvent.queryUsers({
        projectId: BigInt(project.projectId),
        filterQueries: '',
        ...getQueryRange(),
      });

      expect(users).toHaveLength(1);
      expect(users[0].id).toBe(identifiedUser!.id);
      await expectActiveUserMetrics(project.projectId, 1);
    } finally {
      await cleanupProject(project);
    }
  });

  it('exposes ingested data through active-users, user-list, latest-events, and filterable-data queries', async () => {
    const project = nextProjectContext();
    await createProject(project);

    try {
      await identifyUser(project, 'query-user', 'Query User');
      await ingestPageView(project, {
        url: `https://${project.domain}/pricing`,
        identifier: 'query-user',
        displayName: 'Query User',
        contextId: 'query-pageview',
      });
      await ingestEvent(project, {
        name: 'SignupClicked',
        url: `https://${project.domain}/pricing`,
        identifier: 'query-user',
        displayName: 'Query User',
        contextId: 'query-event',
        customData: { plan: 'pro' },
      });

      await waitFor('query validation data', async () => {
        const user = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'query-user');
        if (!user) {
          return false;
        }

        const events = await clickhouseEvent.findByUserId(BigInt(project.projectId), user.id);
        return events.length >= 2;
      });

      const identifiedUser = await clickhouseUser.findByIdentifier(BigInt(project.projectId), 'query-user');
      const { startDate, endDate } = getQueryRange();
      const [users, latestEvents, filterableData] = await Promise.all([
        clickhouseEvent.queryUsers({
          projectId: BigInt(project.projectId),
          filterQueries: '',
          startDate,
          endDate,
        }),
        clickhouseEvent.getLatestEventsByUserId({
          projectId: BigInt(project.projectId),
          userId: identifiedUser!.id,
          limit: 10,
          startDate,
          endDate,
        }),
        clickhouseEvent.getFilterableData(BigInt(project.projectId), startDate, endDate),
      ]);

      expect(users).toHaveLength(1);
      expect(users[0].identifier).toBe('query-user');
      expect(latestEvents.map((event) => event.name)).toEqual(['SignupClicked', '$$pageView']);
      expect(filterableData.eventNames).toContain('SignupClicked');
      expect(filterableData.pages.pathnames).toContain('/pricing');
      await expectActiveUserMetrics(project.projectId, 1);
    } finally {
      await cleanupProject(project);
    }
  });

  it('calculates funnel stages across anonymous, identified, and merged users', async () => {
    const project = nextProjectContext();
    await createProject(project);

    const funnelSteps: FunnelStep[] = [
      {
        id: 'visited-pricing',
        name: 'Visited pricing',
        filter: {
          type: 'page',
          pathFilter: { operator: 'is', value: '/pricing' },
        },
      },
      {
        id: 'clicked-signup',
        name: 'Clicked signup',
        filter: {
          type: 'event',
          nameFilter: { operator: 'is', value: 'SignupClicked' },
        },
      },
      {
        id: 'visited-success',
        name: 'Visited success',
        filter: {
          type: 'page',
          pathFilter: { operator: 'is', value: '/success' },
        },
      },
    ];

    try {
      const funnel = await dbFunnel.create({
        projectId: project.projectId,
        name: 'Pricing to signup',
        icon: null,
        steps: funnelSteps,
      });

      await ingestPageView(project, {
        url: `https://${project.domain}/pricing`,
        userAgent: `${TEST_USER_AGENT} anonymous-step-1`,
        contextId: 'funnel-anonymous-step-1',
      });

      await identifyUser(project, 'identified-step-2');
      await ingestPageView(project, {
        url: `https://${project.domain}/pricing`,
        identifier: 'identified-step-2',
        contextId: 'funnel-identified-step-2-page',
      });
      await ingestEvent(project, {
        name: 'SignupClicked',
        url: `https://${project.domain}/pricing`,
        identifier: 'identified-step-2',
        contextId: 'funnel-identified-step-2-event',
      });

      await identifyUser(project, 'identified-complete');
      await ingestPageView(project, {
        url: `https://${project.domain}/pricing`,
        identifier: 'identified-complete',
        contextId: 'funnel-identified-complete-page',
      });
      await ingestEvent(project, {
        name: 'SignupClicked',
        url: `https://${project.domain}/pricing`,
        identifier: 'identified-complete',
        contextId: 'funnel-identified-complete-event',
      });
      await ingestPageView(project, {
        url: `https://${project.domain}/success`,
        identifier: 'identified-complete',
        contextId: 'funnel-identified-complete-success',
      });

      await identifyUser(project, 'merged-complete');
      const mergedAnonymousUserAgent = `${TEST_USER_AGENT} merged-anonymous-step-1`;
      await ingestPageView(project, {
        url: `https://${project.domain}/pricing`,
        userAgent: mergedAnonymousUserAgent,
        contextId: 'funnel-merged-anonymous-step-1',
      });
      await identifyUser(project, 'merged-complete', 'merged-complete', {
        'user-agent': mergedAnonymousUserAgent,
      });
      await waitForQueuesIdle(30000);
      await ingestEvent(project, {
        name: 'SignupClicked',
        url: `https://${project.domain}/pricing`,
        identifier: 'merged-complete',
        contextId: 'funnel-merged-complete-event',
      });
      await ingestPageView(project, {
        url: `https://${project.domain}/success`,
        identifier: 'merged-complete',
        contextId: 'funnel-merged-complete-success',
      });

      await identifyUser(project, 'event-only');
      await ingestEvent(project, {
        name: 'SignupClicked',
        url: `https://${project.domain}/pricing`,
        identifier: 'event-only',
        contextId: 'funnel-event-only',
      });

      await waitForQueuesIdle(30000);

      await waitForStable(
        'funnel results to include all expected stages',
        async () => {
          const { startDate, endDate } = getQueryRange();
          const results = await clickhouseEvent.getFunnelResults(
            BigInt(project.projectId),
            funnel.steps as FunnelStep[],
            startDate,
            endDate,
          );

          return (
            JSON.stringify(results) ===
            JSON.stringify([
              { funnelStage: 1, userCount: 4 },
              { funnelStage: 2, userCount: 3 },
              { funnelStage: 3, userCount: 2 },
            ])
          );
        },
        30000,
      );

      const { startDate, endDate } = getQueryRange();
      const [funnelResults, mergedUser, completeUser, stepTwoUser] = await Promise.all([
        clickhouseEvent.getFunnelResults(BigInt(project.projectId), funnel.steps as FunnelStep[], startDate, endDate),
        clickhouseUser.findByIdentifier(BigInt(project.projectId), 'merged-complete'),
        clickhouseUser.findByIdentifier(BigInt(project.projectId), 'identified-complete'),
        clickhouseUser.findByIdentifier(BigInt(project.projectId), 'identified-step-2'),
      ]);

      expect(funnelResults).toEqual([
        { funnelStage: 1, userCount: 4 },
        { funnelStage: 2, userCount: 3 },
        { funnelStage: 3, userCount: 2 },
      ]);
      expect(mergedUser).not.toBeNull();
      expect(completeUser).not.toBeNull();
      expect(stepTwoUser).not.toBeNull();

      const [mergedProgress, completeProgress, stepTwoProgress] = await Promise.all([
        clickhouseEvent.getUserFunnelProgress(
          BigInt(project.projectId),
          mergedUser!.id,
          [{ id: funnel.id, name: funnel.name, steps: funnel.steps as FunnelStep[] }],
          startDate,
          endDate,
        ),
        clickhouseEvent.getUserFunnelProgress(
          BigInt(project.projectId),
          completeUser!.id,
          [{ id: funnel.id, name: funnel.name, steps: funnel.steps as FunnelStep[] }],
          startDate,
          endDate,
        ),
        clickhouseEvent.getUserFunnelProgress(
          BigInt(project.projectId),
          stepTwoUser!.id,
          [{ id: funnel.id, name: funnel.name, steps: funnel.steps as FunnelStep[] }],
          startDate,
          endDate,
        ),
      ]);

      expect(mergedProgress).toEqual([
        {
          funnelId: funnel.id,
          funnelName: funnel.name,
          completedStep: 3,
          totalSteps: 3,
        },
      ]);
      expect(completeProgress).toEqual([
        {
          funnelId: funnel.id,
          funnelName: funnel.name,
          completedStep: 3,
          totalSteps: 3,
        },
      ]);
      expect(stepTwoProgress).toEqual([
        {
          funnelId: funnel.id,
          funnelName: funnel.name,
          completedStep: 2,
          totalSteps: 3,
        },
      ]);
      await expectActiveUserMetrics(project.projectId, 5);
    } finally {
      await cleanupProject(project);
    }
  });
});
