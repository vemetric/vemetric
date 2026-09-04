import {
  clickhouseClient,
  clickhouseDateToISO,
  clickhouseEvent,
  clickhouseGlobe,
  clickhouseUser,
  EXAMPLE_EVENT,
  type ClickhouseEvent,
  type ClickhouseUser,
} from 'clickhouse';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PROJECT_ID = BigInt('9000000000000120');

function toClickhouseDate(date: Date) {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function createUser(id: bigint, firstSeenAt: string): ClickhouseUser {
  return {
    projectId: PROJECT_ID,
    id,
    identifier: `user-${id}`,
    displayName: `User ${id}`,
    avatarUrl: '',
    createdAt: firstSeenAt,
    firstSeenAt,
    updatedAt: firstSeenAt,
    countryCode: 'AT',
    city: 'Vienna',
    latitude: null,
    longitude: null,
    customData: {},
  };
}

function createEvent(props: {
  id: string;
  userId?: bigint;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
}): ClickhouseEvent {
  const userId = props.userId ?? BigInt(1);

  return {
    ...EXAMPLE_EVENT,
    projectId: PROJECT_ID,
    userId,
    id: props.id,
    createdAt: props.createdAt,
    userIdentifier: `user-${userId}`,
    userDisplayName: `User ${userId}`,
    countryCode: 'AT',
    city: 'Vienna',
    latitude: props.latitude,
    longitude: props.longitude,
  };
}

async function resetFixtures() {
  const queryParams = { projectId: String(PROJECT_ID) };
  await clickhouseClient.command({
    query: 'ALTER TABLE event DELETE WHERE projectId = {projectId:UInt64} SETTINGS mutations_sync = 2',
    query_params: queryParams,
  });
  await clickhouseClient.command({
    query: 'ALTER TABLE user DELETE WHERE projectId = {projectId:UInt64} SETTINGS mutations_sync = 2',
    query_params: queryParams,
  });
}

describe('globe data queries (integration)', () => {
  const recentUnlocatedAt = new Date(Date.now() - 10_000);
  const olderLocatedAt = new Date(recentUnlocatedAt.getTime() - 60_000);

  beforeAll(async () => {
    await resetFixtures();
    await clickhouseUser.insert([
      createUser(BigInt(1), '2026-01-01 00:00:00.000'),
      createUser(BigInt(2), '2026-01-01 00:00:00.000'),
    ]);
    await clickhouseEvent.insert([
      createEvent({
        id: 'located-event',
        createdAt: toClickhouseDate(olderLocatedAt),
        latitude: 48.2082,
        longitude: 16.3738,
      }),
      createEvent({
        id: 'recent-unlocated-event',
        createdAt: toClickhouseDate(recentUnlocatedAt),
        latitude: null,
        longitude: null,
      }),
      createEvent({
        id: 'new-user-event',
        userId: BigInt(2),
        createdAt: toClickhouseDate(recentUnlocatedAt),
        latitude: null,
        longitude: null,
      }),
    ]);
  });

  afterAll(resetFixtures);

  it('keeps the latest located coordinates but reports presence from the newest event', async () => {
    const buckets = await clickhouseGlobe.queryGlobeBuckets({
      projectId: PROJECT_ID,
      startDate: new Date(olderLocatedAt.getTime() - 1_000),
    });
    const user = buckets.flatMap((bucket) => bucket.users).find((candidate) => candidate.id === BigInt(1));

    expect(user).toMatchObject({ isOnline: true });
    expect(user?.latitude).toBeCloseTo(48.2082, 3);
    expect(user?.longitude).toBeCloseTo(16.3738, 3);
    expect(clickhouseDateToISO(user?.lastSeenAt ?? '')).toBe(recentUnlocatedAt.toISOString());
  });

  it('does not announce a user who was already present when the globe was opened', async () => {
    const watchStartedAt = new Date(olderLocatedAt.getTime() + 30_000);
    const users = await clickhouseGlobe.queryJoinedUsersSince({
      projectId: PROJECT_ID,
      startDate: new Date(olderLocatedAt.getTime() - 1_000),
      since: watchStartedAt,
      limit: 10,
    });

    expect(users.map((user) => user.id)).toEqual([BigInt(2)]);
    expect(clickhouseDateToISO(users[0]?.joinedAt ?? '')).toBe(recentUnlocatedAt.toISOString());
  });
});
