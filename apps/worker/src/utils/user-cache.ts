import type { ClickhouseUser } from 'clickhouse';
import { clickhouseUser } from 'clickhouse';
import { envPositiveInteger } from './env';
import { stateRedis } from '../ingestion/redis';
import type { UserState } from '../ingestion/user-state';
import { userKey as userStateKey } from '../ingestion/user-store';

// Only the user fields event and session enrichment read.
export type IngestionUser = Pick<
  ClickhouseUser,
  'identifier' | 'displayName' | 'countryCode' | 'city' | 'latitude' | 'longitude'
>;

const cacheTtl = envPositiveInteger('USER_CACHE_TTL_SECONDS', 60);
// Blocks caching briefly after a user write, so a lookup that read ClickHouse before
// the write cannot store its stale result afterwards.
const INVALIDATED = '-';
const INVALIDATION_SECONDS = 10;
const userKey = (projectId: bigint, userId: bigint) => `vm:user-lookup:${projectId}:${userId}`;

const toIngestionUser = (user: IngestionUser | undefined | null): IngestionUser | null =>
  user
    ? {
        identifier: user.identifier,
        displayName: user.displayName,
        countryCode: user.countryCode,
        city: user.city,
        latitude: user.latitude,
        longitude: user.longitude,
      }
    : null;

/**
 * Cached `clickhouseUser.findById` for ingestion hot paths. A missing user is cached too:
 * most events belong to anonymous users. While a user's write state is in Redis it is used
 * directly, so changes the flusher has not written yet are visible. User writers call
 * `invalidateIngestionUser`.
 */
export async function findIngestionUser(projectId: bigint, userId: bigint): Promise<IngestionUser | null> {
  const key = userKey(projectId, userId);
  const [state, cached] = await stateRedis().mget(userStateKey(projectId, userId), key);
  if (state) return toIngestionUser((JSON.parse(state) as UserState).user);
  if (cached && cached !== INVALIDATED) return JSON.parse(cached) as IngestionUser | null;

  // Without a state in Redis, ClickHouse holds the latest row: dirty states never expire.
  const value = toIngestionUser(await clickhouseUser.findById(projectId, userId));
  if (!cached) await stateRedis().set(key, JSON.stringify(value), 'EX', cacheTtl, 'NX');
  return value;
}

export async function invalidateIngestionUser(projectId: bigint, userId: bigint) {
  await stateRedis().set(userKey(projectId, userId), INVALIDATED, 'EX', INVALIDATION_SECONDS);
}
