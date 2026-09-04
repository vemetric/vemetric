import { generateEventId } from '@vemetric/common/id';
import { clickhouseClient, clickhouseEvent, clickhouseSession, clickhouseUser } from 'clickhouse';
import type { ClickhouseEvent, ClickhouseSession, ClickhouseUser } from 'clickhouse';
import { generateSessionId, generateUserId, prismaClient } from 'database';

const IMPORT_SOURCE = 'local-random-user-seed';
const PROJECT_NAME = process.env.SEED_PROJECT_NAME ?? 'Vemetric';
const PROJECT_DOMAIN = process.env.SEED_PROJECT_DOMAIN ?? 'vemetric.local';
const NOW = new Date();

interface SeedLocation {
  countryCode: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  pathname: string;
}

const LOCATIONS: Array<SeedLocation> = [
  {
    countryCode: 'AR',
    country: 'Argentina',
    city: 'Buenos Aires',
    latitude: -34.6037,
    longitude: -58.3816,
    pathname: '/customers/south-america',
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    city: 'Sydney',
    latitude: -33.8688,
    longitude: 151.2093,
    pathname: '/pricing',
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    city: 'Toronto',
    latitude: 43.6532,
    longitude: -79.3832,
    pathname: '/docs/getting-started',
  },
  {
    countryCode: 'CL',
    country: 'Chile',
    city: 'Santiago',
    latitude: -33.4489,
    longitude: -70.6693,
    pathname: '/features/analytics',
  },
  {
    countryCode: 'DE',
    country: 'Germany',
    city: 'Hamburg',
    latitude: 53.5511,
    longitude: 9.9937,
    pathname: '/blog/product-updates',
  },
  {
    countryCode: 'EG',
    country: 'Egypt',
    city: 'Cairo',
    latitude: 30.0444,
    longitude: 31.2357,
    pathname: '/customers/enterprise',
  },
  {
    countryCode: 'ES',
    country: 'Spain',
    city: 'Barcelona',
    latitude: 41.3874,
    longitude: 2.1686,
    pathname: '/use-cases',
  },
  {
    countryCode: 'GB',
    country: 'United Kingdom',
    city: 'London',
    latitude: 51.5072,
    longitude: -0.1276,
    pathname: '/docs/events',
  },
  {
    countryCode: 'IN',
    country: 'India',
    city: 'Bengaluru',
    latitude: 12.9716,
    longitude: 77.5946,
    pathname: '/integrations',
  },
  {
    countryCode: 'JP',
    country: 'Japan',
    city: 'Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
    pathname: '/dashboard',
  },
  {
    countryCode: 'KE',
    country: 'Kenya',
    city: 'Nairobi',
    latitude: -1.2921,
    longitude: 36.8219,
    pathname: '/customers/startups',
  },
  {
    countryCode: 'MX',
    country: 'Mexico',
    city: 'Mexico City',
    latitude: 19.4326,
    longitude: -99.1332,
    pathname: '/signup',
  },
  {
    countryCode: 'US',
    country: 'United States',
    city: 'Chicago',
    latitude: 41.8781,
    longitude: -87.6298,
    pathname: '/changelog',
  },
  {
    countryCode: 'ZA',
    country: 'South Africa',
    city: 'Cape Town',
    latitude: -33.9249,
    longitude: 18.4241,
    pathname: '/demo',
  },
];

const NAMES = [
  'Ada Lovelace',
  'Alan Turing',
  'Grace Hopper',
  'Katherine Johnson',
  'Edsger Dijkstra',
  'Margaret Hamilton',
  'Donald Knuth',
  'Barbara Liskov',
];

const USER_AGENTS = [
  {
    value:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    osName: 'macOS',
    osVersion: '15.5',
    clientName: 'Chrome',
    clientVersion: '125.0',
    deviceType: 'desktop',
  },
  {
    value:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    osName: 'iOS',
    osVersion: '18.5',
    clientName: 'Safari Mobile',
    clientVersion: '18.5',
    deviceType: 'mobile',
  },
  {
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/125.0 Safari/537.36',
    osName: 'Windows',
    osVersion: '10',
    clientName: 'Edge',
    clientVersion: '125.0',
    deviceType: 'desktop',
  },
] as const;

function sample<T>(values: ReadonlyArray<T>): T {
  return values[Math.floor(Math.random() * values.length)]!;
}

function clickhouseDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function main() {
  const project = await prismaClient.project.findFirst({
    where: {
      OR: [{ name: PROJECT_NAME }, { domain: PROJECT_DOMAIN }],
    },
    select: { id: true, name: true, domain: true, firstEventAt: true },
  });

  if (!project) {
    throw new Error(`Could not find local project by name "${PROJECT_NAME}" or domain "${PROJECT_DOMAIN}".`);
  }

  const projectId = BigInt(project.id);
  const userId = generateUserId();
  const sessionId = generateSessionId();
  const contextId = generateSessionId();
  const eventId = generateEventId();
  const location = sample(LOCATIONS);
  const userAgent = sample(USER_AGENTS);
  const isIdentified = Math.random() >= 0.5;
  const displayName = isIdentified ? `${sample(NAMES)} ${Math.floor(100 + Math.random() * 900)}` : '';
  const identifier = isIdentified ? `seed_user_${String(userId)}@example.com` : '';
  const eventCreatedAt = new Date(Math.ceil(NOW.getTime() / 1000) * 1000 + 1000 + Math.floor(Math.random() * 1000));
  const sessionStartedAt = new Date(eventCreatedAt.getTime() - (1 + Math.floor(Math.random() * 5)) * 1000);
  const referrerType = Math.random() >= 0.5 ? 'direct' : 'search';
  const referrer = referrerType === 'search' ? 'Google' : '';
  const referrerUrl = referrerType === 'search' ? 'https://google.com/search?q=product+analytics' : '';
  const origin = `https://${project.domain}`;

  const user: ClickhouseUser = {
    projectId,
    id: userId,
    identifier,
    displayName,
    avatarUrl: '',
    createdAt: clickhouseDate(eventCreatedAt),
    firstSeenAt: clickhouseDate(eventCreatedAt),
    updatedAt: clickhouseDate(eventCreatedAt),
    initialDeviceId: userId,
    countryCode: location.countryCode,
    city: location.city,
    latitude: location.latitude,
    longitude: location.longitude,
    userAgent: userAgent.value,
    referrer,
    referrerUrl,
    referrerType,
    origin,
    pathname: location.pathname,
    urlHash: '',
    queryParams: {},
    utmSource: referrerType === 'search' ? 'google' : '',
    utmMedium: referrerType === 'search' ? 'organic' : '',
    utmCampaign: '',
    utmContent: '',
    utmTerm: '',
    customData: {
      seedSource: IMPORT_SOURCE,
      accountType: sample(['starter', 'pro', 'business']),
      country: location.country,
      testCase: 'random-user',
    },
  };

  const session: ClickhouseSession = {
    projectId,
    userId,
    id: sessionId,
    userIdentifier: identifier,
    userDisplayName: displayName,
    startedAt: clickhouseDate(sessionStartedAt),
    endedAt: clickhouseDate(eventCreatedAt),
    duration: Math.floor((eventCreatedAt.getTime() - sessionStartedAt.getTime()) / 1000),
    countryCode: location.countryCode,
    city: location.city,
    latitude: location.latitude,
    longitude: location.longitude,
    userAgent: userAgent.value,
    referrer,
    referrerUrl,
    referrerType,
    origin,
    pathname: location.pathname,
    urlHash: '',
    queryParams: {},
    utmSource: referrerType === 'search' ? 'google' : '',
    utmMedium: referrerType === 'search' ? 'organic' : '',
    utmCampaign: '',
    utmContent: '',
    utmTerm: '',
    importSource: IMPORT_SOURCE,
  };

  const event: ClickhouseEvent = {
    projectId,
    userId,
    sessionId,
    deviceId: userId,
    contextId,
    createdAt: clickhouseDate(eventCreatedAt),
    id: eventId,
    name: '$$pageView',
    isPageView: true,
    userAgent: userAgent.value,
    userIdentifier: identifier,
    userDisplayName: displayName,
    requestHeaders: {},
    customData: {
      title: `${location.city} seed pageview`,
      seedSource: IMPORT_SOURCE,
      testCase: 'random-user',
    },
    importSource: IMPORT_SOURCE,
    countryCode: location.countryCode,
    city: location.city,
    latitude: location.latitude,
    longitude: location.longitude,
    osName: userAgent.osName,
    osVersion: userAgent.osVersion,
    clientName: userAgent.clientName,
    clientVersion: userAgent.clientVersion,
    clientType: 'browser',
    deviceType: userAgent.deviceType,
    referrer,
    referrerUrl,
    referrerType,
    origin,
    pathname: location.pathname,
    urlHash: '',
    queryParams: {},
    utmSource: referrerType === 'search' ? 'google' : '',
    utmMedium: referrerType === 'search' ? 'organic' : '',
    utmCampaign: '',
    utmContent: '',
    utmTerm: '',
  };

  await clickhouseUser.insert([user]);
  await clickhouseSession.insert([session]);
  await clickhouseEvent.insert([event]);

  if (identifier) {
    await prismaClient.userIdentificationMap.create({
      data: {
        projectId: project.id,
        userId: String(userId),
        identifier,
      },
    });
  }

  if (!project.firstEventAt || project.firstEventAt > eventCreatedAt) {
    await prismaClient.project.update({
      where: { id: project.id },
      data: { firstEventAt: eventCreatedAt },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Inserted random user "${displayName || 'Anonymous'}" (${String(userId)}) for ${project.name} at ${location.city}, ${location.country}.`,
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaClient.$disconnect();
    await clickhouseClient.close();
  });
