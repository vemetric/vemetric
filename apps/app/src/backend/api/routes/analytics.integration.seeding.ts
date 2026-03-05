import { createHash } from 'node:crypto';
import {
  type DeviceData,
  clickhouseClient,
  clickhouseEvent,
  clickhouseSession,
  type ClickhouseEvent,
  type ClickhouseSession,
} from 'clickhouse';

type ApiKeyProjectRecord = {
  id: string;
  projectId: string;
  project: {
    id: string;
    name: string;
    domain: string;
    token: string;
    createdAt: Date;
    firstEventAt: Date | null;
    publicDashboard: boolean;
    excludedIps: string | null;
    excludedCountries: string | null;
  };
};

export type IsolatedAnalyticsSeedContext = {
  projectId: string;
  rawApiKey: string;
  keyHash: string;
  authHeaders: {
    Authorization: string;
    'Content-Type': 'application/json';
  };
  apiKeyRecord: ApiKeyProjectRecord;
};

type IsolatedAnalyticsSeedOptions = {
  projectId?: string;
  keySeed?: number;
  projectName?: string;
  projectDomain?: string;
};

const ANALYTICS_TEST_PROJECT_ID = '9000000000000001';
const ANALYTICS_TEST_KEY_SEED = 1;
const KEEP_ANALYTICS_TEST_DATA = process.env.KEEP_ANALYTICS_TEST_DATA === '1';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function buildRawApiKey(seed: number): string {
  // auth middleware requires exactly 36 chars total and "vem_" prefix
  const suffix = String(seed).padStart(32, '0');
  return `vem_${suffix}`;
}

function getDefaultDisplayName(userId: bigint): string {
  const value = Number(userId);
  if (value === 1) {
    return 'Zulu';
  }
  if (value === 2) {
    return 'Echo';
  }
  if (value === 3) {
    return 'Bravo';
  }
  if (value === 4) {
    return 'Charlie';
  }
  return `User ${userId}`;
}

function baseSession(input: {
  projectId: bigint;
  userId: bigint;
  id: string;
  startedAt: string;
  endedAt: string;
  duration: number;
  countryCode: string;
  userIdentifier?: string;
  userDisplayName?: string;
  city?: string;
  referrer?: string;
  referrerUrl?: string;
  referrerType?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}): ClickhouseSession {
  return {
    projectId: input.projectId,
    userId: input.userId,
    id: input.id,
    userIdentifier: input.userIdentifier ?? `user-${input.userId}`,
    userDisplayName: input.userDisplayName ?? getDefaultDisplayName(input.userId),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    duration: input.duration,
    countryCode: input.countryCode,
    city: input.city ?? (input.countryCode === 'DE' ? 'Berlin' : 'New York'),
    latitude: null,
    longitude: null,
    userAgent: 'Mozilla/5.0',
    referrer: input.referrer ?? 'Google',
    referrerUrl: input.referrerUrl ?? 'https://google.com',
    referrerType: input.referrerType ?? 'search',
    origin: 'https://example.com',
    pathname: '/',
    urlHash: '',
    queryParams: {},
    utmSource: input.utmSource ?? '',
    utmMedium: input.utmMedium ?? '',
    utmCampaign: input.utmCampaign ?? '',
    utmContent: input.utmContent ?? '',
    utmTerm: input.utmTerm ?? '',
    importSource: 'integration-test',
  };
}

function baseEvent(input: {
  projectId: bigint;
  userId: bigint;
  sessionId: string;
  id: string;
  createdAt: string;
  isPageView: boolean;
  name: string;
  countryCode: string;
  pathname: string;
  userIdentifier?: string;
  userDisplayName?: string;
  customData?: Record<string, unknown>;
  city?: string;
  browser?: string;
  deviceType?: DeviceData['deviceType'];
  os?: string;
  referrer?: string;
  referrerUrl?: string;
  referrerType?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}): ClickhouseEvent {
  return {
    projectId: input.projectId,
    userId: input.userId,
    sessionId: input.sessionId,
    deviceId: input.userId,
    contextId: `${input.sessionId}:ctx`,
    createdAt: input.createdAt,
    id: input.id,
    name: input.name,
    isPageView: input.isPageView,
    userAgent: 'Mozilla/5.0',
    userIdentifier: input.userIdentifier ?? `user-${input.userId}`,
    userDisplayName: input.userDisplayName ?? getDefaultDisplayName(input.userId),
    requestHeaders: {},
    customData: input.customData ?? {},
    importSource: 'integration-test',
    osName: input.os ?? 'macOS',
    osVersion: '14',
    clientName: input.browser ?? 'Chrome',
    clientVersion: '123',
    clientType: 'browser',
    deviceType: input.deviceType ?? 'desktop',
    countryCode: input.countryCode,
    city: input.city ?? (input.countryCode === 'DE' ? 'Berlin' : 'New York'),
    latitude: null,
    longitude: null,
    referrer: input.referrer ?? 'Google',
    referrerUrl: input.referrerUrl ?? 'https://google.com',
    referrerType: input.referrerType ?? 'search',
    origin: 'https://example.com',
    pathname: input.pathname,
    urlHash: '',
    queryParams: {},
    utmSource: input.utmSource ?? '',
    utmMedium: input.utmMedium ?? '',
    utmCampaign: input.utmCampaign ?? '',
    utmContent: input.utmContent ?? '',
    utmTerm: input.utmTerm ?? '',
  };
}

export function createIsolatedAnalyticsSeedContext(
  options: IsolatedAnalyticsSeedOptions = {},
): IsolatedAnalyticsSeedContext {
  const projectId = options.projectId ?? ANALYTICS_TEST_PROJECT_ID;
  const keySeed = options.keySeed ?? ANALYTICS_TEST_KEY_SEED;
  const rawApiKey = buildRawApiKey(keySeed);
  const keyHash = sha256(rawApiKey);

  return {
    projectId,
    rawApiKey,
    keyHash,
    authHeaders: {
      Authorization: `Bearer ${rawApiKey}`,
      'Content-Type': 'application/json',
    },
    apiKeyRecord: {
      id: `key_${projectId}`,
      projectId,
      project: {
        id: projectId,
        name: options.projectName ?? 'Analytics Integration Test Project',
        domain: options.projectDomain ?? 'analytics-integration-test.example.com',
        token: `token_${projectId}`,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        firstEventAt: new Date('2026-01-18T09:00:00.000Z'),
        publicDashboard: false,
        excludedIps: null,
        excludedCountries: null,
      },
    },
  };
}

async function truncateAnalyticsFixtureData(projectId: string): Promise<void> {
  if (KEEP_ANALYTICS_TEST_DATA) {
    return;
  }

  await clickhouseClient.command({
    query: 'ALTER TABLE event DELETE WHERE projectId = {projectId:UInt64} SETTINGS mutations_sync = 2',
    query_params: { projectId },
  });

  await clickhouseClient.command({
    query: 'ALTER TABLE session DELETE WHERE projectId = {projectId:UInt64} SETTINGS mutations_sync = 2',
    query_params: { projectId },
  });
}

export async function resetAnalyticsFixtureData(context: IsolatedAnalyticsSeedContext): Promise<void> {
  await truncateAnalyticsFixtureData(context.projectId);
}

/**
 * Seed deterministic ClickHouse rows for one isolated project.
 *
 * Dataset shape:
 * - Users: 4
 * - Countries: US (3 users), DE (1 user)
 * - Dates: 2026-01-18 and 2026-01-19 (UTC)
 * - Pageviews: 8
 * - Events (non-pageviews): 5
 * - Bounce rate: 50% (2 of 4 sessions have exactly one pageview)
 * - visit_duration average: 120
 * - signup plan split: pro=2, starter=1
 */
export async function seedAnalyticsFixtureData(context: IsolatedAnalyticsSeedContext): Promise<void> {
  await truncateAnalyticsFixtureData(context.projectId);

  const projectId = BigInt(context.projectId);
  const dimensionsByUser = {
    1: {
      city: 'New York',
      browser: 'Chrome',
      deviceType: 'desktop',
      os: 'macOS',
      referrer: 'Google',
      referrerUrl: 'https://google.com',
      referrerType: 'search',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'winter_launch',
      utmContent: 'hero_cta',
      utmTerm: 'analytics',
    },
    2: {
      city: '',
      browser: 'Firefox',
      deviceType: 'mobile',
      os: 'Windows',
      referrer: '',
      referrerUrl: 'https://news.ycombinator.com',
      referrerType: 'social',
      utmSource: 'hn',
      utmMedium: 'social',
      utmCampaign: 'winter_launch',
      utmContent: 'text_link',
      utmTerm: 'opensource',
    },
    3: {
      city: 'San Francisco',
      browser: 'Safari',
      deviceType: 'desktop',
      os: 'macOS',
      referrer: 'Newsletter',
      referrerUrl: 'https://newsletter.example.com',
      referrerType: 'email',
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'jan_push',
      utmContent: 'button',
      utmTerm: 'metrics',
    },
    4: {
      city: 'Berlin',
      browser: 'Chrome',
      deviceType: 'tablet',
      os: 'Linux',
      referrer: 'Bing',
      referrerUrl: 'https://bing.com',
      referrerType: 'search',
      utmSource: 'bing',
      utmMedium: 'cpc',
      utmCampaign: 'jan_push',
      utmContent: 'ad_1',
      utmTerm: 'privacy',
    },
  } as const;

  const sessions: ClickhouseSession[] = [
    baseSession({
      projectId,
      userId: BigInt(1),
      id: `${context.projectId}_s1`,
      startedAt: '2026-01-18 09:00:00',
      endedAt: '2026-01-18 09:05:00',
      duration: 60,
      countryCode: 'US',
      ...dimensionsByUser[1],
    }),
    baseSession({
      projectId,
      userId: BigInt(2),
      id: `${context.projectId}_s2`,
      startedAt: '2026-01-18 10:00:00',
      endedAt: '2026-01-18 10:15:00',
      duration: 120,
      countryCode: 'US',
      ...dimensionsByUser[2],
    }),
    baseSession({
      projectId,
      userId: BigInt(3),
      id: `${context.projectId}_s3`,
      startedAt: '2026-01-19 09:00:00',
      endedAt: '2026-01-19 09:20:00',
      duration: 120,
      countryCode: 'US',
      ...dimensionsByUser[3],
    }),
    baseSession({
      projectId,
      userId: BigInt(4),
      id: `${context.projectId}_s4`,
      startedAt: '2026-01-19 11:00:00',
      endedAt: '2026-01-19 11:25:00',
      duration: 180,
      countryCode: 'DE',
      ...dimensionsByUser[4],
    }),
    // Anonymous user outside analytics test ranges but inside free-plan retention window
    baseSession({
      projectId,
      userId: BigInt(5),
      id: `${context.projectId}_s5`,
      startedAt: '2025-12-25 08:00:00',
      endedAt: '2025-12-25 08:03:00',
      duration: 45,
      countryCode: '',
      userIdentifier: '',
      userDisplayName: '',
      city: '',
      referrer: '',
      referrerUrl: '',
      referrerType: 'direct',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      utmContent: '',
      utmTerm: '',
    }),
  ];

  const events: ClickhouseEvent[] = [
    // Day 1 pageviews (4 total)
    baseEvent({
      projectId,
      userId: BigInt(1),
      sessionId: `${context.projectId}_s1`,
      id: `${context.projectId}_e_pv_1`,
      createdAt: '2026-01-18 09:01:00',
      isPageView: true,
      name: '',
      countryCode: 'US',
      pathname: '/',
      ...dimensionsByUser[1],
    }),
    baseEvent({
      projectId,
      userId: BigInt(2),
      sessionId: `${context.projectId}_s2`,
      id: `${context.projectId}_e_pv_2`,
      createdAt: '2026-01-18 10:01:00',
      isPageView: true,
      name: '',
      countryCode: 'US',
      pathname: '/',
      ...dimensionsByUser[2],
    }),
    baseEvent({
      projectId,
      userId: BigInt(2),
      sessionId: `${context.projectId}_s2`,
      id: `${context.projectId}_e_pv_3`,
      createdAt: '2026-01-18 10:03:00',
      isPageView: true,
      name: '',
      countryCode: 'US',
      pathname: '/pricing',
      ...dimensionsByUser[2],
    }),
    baseEvent({
      projectId,
      userId: BigInt(2),
      sessionId: `${context.projectId}_s2`,
      id: `${context.projectId}_e_pv_4`,
      createdAt: '2026-01-18 10:05:00',
      isPageView: true,
      name: '',
      countryCode: 'US',
      pathname: '/signup',
      ...dimensionsByUser[2],
    }),

    // Day 2 pageviews (4 total)
    baseEvent({
      projectId,
      userId: BigInt(3),
      sessionId: `${context.projectId}_s3`,
      id: `${context.projectId}_e_pv_5`,
      createdAt: '2026-01-19 09:01:00',
      isPageView: true,
      name: '',
      countryCode: 'US',
      pathname: '/',
      ...dimensionsByUser[3],
    }),
    baseEvent({
      projectId,
      userId: BigInt(3),
      sessionId: `${context.projectId}_s3`,
      id: `${context.projectId}_e_pv_6`,
      createdAt: '2026-01-19 09:05:00',
      isPageView: true,
      name: '',
      countryCode: 'US',
      pathname: '/features',
      ...dimensionsByUser[3],
    }),
    baseEvent({
      projectId,
      userId: BigInt(3),
      sessionId: `${context.projectId}_s3`,
      id: `${context.projectId}_e_pv_7`,
      createdAt: '2026-01-19 09:10:00',
      isPageView: true,
      name: '',
      countryCode: 'US',
      pathname: '/pricing',
      ...dimensionsByUser[3],
    }),
    baseEvent({
      projectId,
      userId: BigInt(4),
      sessionId: `${context.projectId}_s4`,
      id: `${context.projectId}_e_pv_8`,
      createdAt: '2026-01-19 11:05:00',
      isPageView: true,
      name: '',
      countryCode: 'DE',
      pathname: '/',
      ...dimensionsByUser[4],
    }),

    // Non-pageview events (5 total; day1=2, day2=3)
    baseEvent({
      projectId,
      userId: BigInt(1),
      sessionId: `${context.projectId}_s1`,
      id: `${context.projectId}_e_evt_1`,
      createdAt: '2026-01-18 09:02:00',
      isPageView: false,
      name: 'signup',
      countryCode: 'US',
      pathname: '/signup',
      customData: { plan: 'pro' },
      ...dimensionsByUser[1],
    }),
    baseEvent({
      projectId,
      userId: BigInt(2),
      sessionId: `${context.projectId}_s2`,
      id: `${context.projectId}_e_evt_2`,
      createdAt: '2026-01-18 10:06:00',
      isPageView: false,
      name: 'click',
      countryCode: 'US',
      pathname: '/pricing',
      ...dimensionsByUser[2],
    }),
    baseEvent({
      projectId,
      userId: BigInt(3),
      sessionId: `${context.projectId}_s3`,
      id: `${context.projectId}_e_evt_3`,
      createdAt: '2026-01-19 09:11:00',
      isPageView: false,
      name: 'signup',
      countryCode: 'US',
      pathname: '/signup',
      customData: { plan: 'starter' },
      ...dimensionsByUser[3],
    }),
    baseEvent({
      projectId,
      userId: BigInt(3),
      sessionId: `${context.projectId}_s3`,
      id: `${context.projectId}_e_evt_4`,
      createdAt: '2026-01-19 09:15:00',
      isPageView: false,
      name: 'signup',
      countryCode: 'US',
      pathname: '/signup',
      customData: { plan: 'pro' },
      ...dimensionsByUser[3],
    }),
    baseEvent({
      projectId,
      userId: BigInt(4),
      sessionId: `${context.projectId}_s4`,
      id: `${context.projectId}_e_evt_5`,
      createdAt: '2026-01-19 11:20:00',
      isPageView: false,
      name: 'purchase',
      countryCode: 'DE',
      pathname: '/checkout',
      ...dimensionsByUser[4],
    }),
    // Anonymous pageview used by users endpoint tests
    baseEvent({
      projectId,
      userId: BigInt(5),
      sessionId: `${context.projectId}_s5`,
      id: `${context.projectId}_e_pv_anon_1`,
      createdAt: '2025-12-25 08:01:00',
      isPageView: true,
      name: '',
      countryCode: '',
      pathname: '/landing',
      userIdentifier: '',
      userDisplayName: '',
      city: '',
      referrer: '',
      referrerUrl: '',
      referrerType: 'direct',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      utmContent: '',
      utmTerm: '',
    }),
  ];

  await clickhouseSession.insert(sessions);
  await clickhouseEvent.insert(events);
}
