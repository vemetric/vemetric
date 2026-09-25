import type { ClickhouseUser } from 'clickhouse';
import { clickhouseUser } from 'clickhouse';
import { positiveStateInteger, stateRedis } from '../ingestion';

// Only the user fields event and session enrichment read.
export type IngestionUser = Pick<
  ClickhouseUser,
  'identifier' | 'displayName' | 'countryCode' | 'city' | 'latitude' | 'longitude'
>;

const cacheTtl = positiveStateInteger('USER_CACHE_TTL_SECONDS', 60);
// Blocks caching briefly after a user write, so a lookup that read ClickHouse before
// the write cannot store its stale result afterwards.
const INVALIDATED = '-';
const INVALIDATION_SECONDS = 10;
const userKey = (projectId: bigint, userId: bigint) => `vm:user-lookup:${projectId}:${userId}`;

/**
 * Cached `clickhouseUser.findById` for ingestion hot paths. A missing user is cached too:
 * most events belong to anonymous users. User writers call `invalidateIngestionUser`.
 */
export async function findIngestionUser(projectId: bigint, userId: bigint): Promise<IngestionUser | null> {
  const key = userKey(projectId, userId);
  const cached = await stateRedis().get(key);
  if (cached && cached !== INVALIDATED) return JSON.parse(cached) as IngestionUser | null;

  const user = await clickhouseUser.findById(projectId, userId);
  const value: IngestionUser | null = user
    ? {
        identifier: user.identifier,
        displayName: user.displayName,
        countryCode: user.countryCode,
        city: user.city,
        latitude: user.latitude,
        longitude: user.longitude,
      }
    : null;
  if (!cached) await stateRedis().set(key, JSON.stringify(value), 'EX', cacheTtl, 'NX');
  return value;
}

export async function invalidateIngestionUser(projectId: bigint, userId: bigint) {
  await stateRedis().set(userKey(projectId, userId), INVALIDATED, 'EX', INVALIDATION_SECONDS);
}
