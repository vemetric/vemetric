import { clickhouseUser } from 'clickhouse';
import type { ChainableCommander } from 'ioredis';
import { stateRedis } from './redis';
import { userKeyPrefix, type UserCommands } from './user-redis-commands';
import { normalizeTimestamp, toStoredUser, type UserState } from './user-state';
import { envPositiveInteger } from '../utils/env';
import { logger } from '../utils/logger';

const dirtyKey = `${userKeyPrefix}dirty`;
export const userCleanTtl = envPositiveInteger('USER_STATE_CACHE_TTL_SECONDS', 120);
// Updates for a user that does not exist yet wait this long for the create.
export const pendingUserTtl = envPositiveInteger('USER_PENDING_UPDATE_TTL_SECONDS', 3600);
export const userKey = (projectId: bigint | string, userId: bigint | string) =>
  `${userKeyPrefix}${projectId}:${userId}`;

export interface UserSnapshot {
  key: string;
  raw: string;
  state: UserState;
}

// A missing key means the state is clean and expired (dirty states never expire), so ClickHouse
// holds the latest row. Hydration only fills the cache and never overwrites a concurrent writer.
async function loadUser(key: string): Promise<{ raw: string; state: UserState }> {
  const redis = stateRedis();
  const cached = await redis.get(key);
  if (cached) return { raw: cached, state: JSON.parse(cached) as UserState };
  const [projectId, userId] = key.slice(userKeyPrefix.length).split(':');
  const row = await clickhouseUser.findById(BigInt(projectId!), BigInt(userId!));
  const state: UserState = { revision: 0 };
  if (row) {
    const user = toStoredUser(row);
    state.user = { ...user, updatedAt: normalizeTimestamp(user.updatedAt) };
  }
  const raw = JSON.stringify(state);
  if (await redis.set(key, raw, 'EX', userCleanTtl, 'NX')) return { raw, state };
  return loadUser(key);
}

async function commitIfUnchanged(snapshot: UserSnapshot, dirty: boolean) {
  const revision = snapshot.state.revision + 1;
  if (!Number.isSafeInteger(revision)) throw new Error('User revision overflow');
  const next = { ...snapshot.state, revision };
  return (
    (await stateRedis().commitUser(
      dirtyKey,
      snapshot.key,
      snapshot.raw,
      JSON.stringify(next),
      dirty ? '1' : '0',
      Date.now(),
      next.user ? userCleanTtl : pendingUserTtl,
    )) === 1
  );
}

async function readPending(limit: number): Promise<UserSnapshot[]> {
  const redis = stateRedis();
  const keys = await redis.zrange(dirtyKey, 0, limit - 1);
  if (!keys.length) return [];
  const values = await redis.mget(...keys);
  const snapshots: UserSnapshot[] = [];
  for (const [index, key] of Array.from(keys.entries())) {
    const raw = values[index];
    if (raw) {
      const state = JSON.parse(raw) as UserState;
      if (state.user) snapshots.push({ key, raw, state });
    } else if (await redis.zscore(dirtyKey, key)) {
      // Lost outside this code (eviction, manual deletion): report it and keep flushing the rest.
      logger.error({ key }, 'Missing dirty user state');
      await redis.zrem(dirtyKey, key);
    }
  }
  return snapshots;
}

async function acknowledgeFlush(snapshots: UserSnapshot[]) {
  const pipeline = stateRedis().pipeline() as ChainableCommander & UserCommands;
  const now = Date.now();
  for (const snapshot of snapshots) {
    pipeline.acknowledgeUser(snapshot.key, dirtyKey, snapshot.raw, userCleanTtl, now);
  }
  const results = await pipeline.exec();
  for (const [error] of results ?? []) {
    if (error) throw error;
  }
}

// Monitoring: user rows waiting for the flusher and how long the oldest one has been waiting.
async function pendingStats() {
  const redis = stateRedis();
  const [count, oldest] = await Promise.all([redis.zcard(dirtyKey), redis.zrange(dirtyKey, 0, 0, 'WITHSCORES')]);
  const oldestAgeSeconds = oldest[1] ? Math.max(0, (Date.now() - Number(oldest[1])) / 1000) : 0;
  return { count, oldestAgeSeconds };
}

export const userStore = { load: loadUser, commitIfUnchanged, readPending, acknowledgeFlush, pendingStats };
