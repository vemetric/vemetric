import { clickhouseSession, type SessionRevisionRow } from 'clickhouse';
import type { ChainableCommander } from 'ioredis';
import { positiveStateInteger, stateRedis } from './redis';
import type { IngestionCommands } from './session-redis-commands';
import type { SessionState, StoredSession } from './session-state';

export const sessionKeyPrefix = 'vm:{session-state}:';
const dirtyKey = `${sessionKeyPrefix}dirty`;
const cleanTtl = positiveStateInteger('SESSION_STATE_CACHE_TTL_SECONDS', 300);
export const sessionKey = (projectId: bigint | string, id: string) => `${sessionKeyPrefix}${projectId}:${id}`;
export const sessionUserKey = (projectId: bigint | string, userId: bigint | string) =>
  `${sessionKeyPrefix}user:${projectId}:${userId}`;

export interface SessionSnapshot {
  key: string;
  raw: string;
  state: SessionState;
}

function emptyState(): SessionState {
  return { revision: 0, latestAt: '' };
}

async function loadSession(key: string): Promise<{ raw: string; state: SessionState }> {
  const redis = stateRedis();
  const cached = await redis.get(key);
  if (cached) return { raw: cached, state: JSON.parse(cached) as SessionState };
  const [projectId, ...idParts] = key.slice(sessionKeyPrefix.length).split(':');
  const row: SessionRevisionRow | null = await clickhouseSession.findLatestRevision(projectId!, idParts.join(':'));
  let state = emptyState();
  if (row) {
    // deleted is the storage tombstone flag; cached state carries the boolean instead.
    const { revision, deleted, ...columns } = row;
    const session: StoredSession = {
      ...columns,
      projectId: String(columns.projectId),
      userId: String(columns.userId),
      userIdentifier: columns.userIdentifier ?? undefined,
      userDisplayName: columns.userDisplayName ?? undefined,
      queryParams: JSON.parse(columns.queryParams || '{}'),
      // An unset FixedString(2) is returned as two zero bytes by ClickHouse.
      countryCode: columns.countryCode?.replace(/\0/g, '') ?? '',
    };
    state = {
      revision: Number(revision),
      latestAt: session.endedAt,
      session,
      deleted: Number(deleted) === 1,
    };
    if (!Number.isSafeInteger(state.revision)) throw new Error('Session revision overflow');
  }
  const raw = JSON.stringify(state);
  // Hydration is only a cache fill. Never overwrite state produced by a concurrent writer.
  if (await redis.set(key, raw, 'EX', cleanTtl, 'NX')) return { raw, state };
  return loadSession(key);
}

async function commitIfUnchanged(entries: SessionSnapshot[]) {
  const values: string[] = [];
  for (const entry of entries) {
    const revision = entry.state.revision + 1;
    if (!Number.isSafeInteger(revision)) throw new Error('Session revision overflow');
    values.push(entry.raw, JSON.stringify({ ...entry.state, revision }));
  }
  return (
    (await stateRedis().commitSessions(
      entries.length + 1,
      dirtyKey,
      ...entries.map((entry) => entry.key),
      ...values,
      Date.now(),
      cleanTtl,
    )) === 1
  );
}

async function readPending(limit: number, onlyKeys?: string[]): Promise<SessionSnapshot[]> {
  const redis = stateRedis();
  const keys = onlyKeys ?? (await redis.zrange(dirtyKey, 0, limit - 1));
  if (!keys.length) return [];
  const values = await redis.mget(...keys);
  const snapshots: SessionSnapshot[] = [];
  for (const [index, key] of Array.from(keys.entries())) {
    const raw = values[index];
    if (raw) {
      const state = JSON.parse(raw) as SessionState;
      // Explicit key flushes must also leave early activity in Redis only.
      if (state.session || state.deleted) snapshots.push({ key, raw, state });
    }
    // A concurrent successful flush may have cleaned and expired this key already.
    else if (await redis.zscore(dirtyKey, key)) throw new Error('Missing dirty session state');
  }
  return snapshots;
}

// One pipelined round-trip for the whole batch; a failed acknowledgement stays dirty for the next tick.
async function acknowledgeFlush(snapshots: SessionSnapshot[]) {
  const pipeline = stateRedis().pipeline() as ChainableCommander & IngestionCommands;
  const now = Date.now();
  for (const snapshot of snapshots) {
    pipeline.acknowledgeSession(snapshot.key, dirtyKey, snapshot.raw, cleanTtl, now);
  }
  const results = await pipeline.exec();
  for (const [error] of results ?? []) {
    if (error) throw error;
  }
}

export const sessionStore = { load: loadSession, commitIfUnchanged, readPending, acknowledgeFlush };
