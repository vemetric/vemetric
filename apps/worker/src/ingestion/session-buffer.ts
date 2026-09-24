import { formatClickhouseDate } from '@vemetric/common/date';
import type { GeoData } from '@vemetric/common/geo';
import type { ClickhouseSession } from 'clickhouse';
import { clickhouseDateToISO } from 'clickhouse';
import { stateRedis } from './redis';
import { combineSession, publicSession, storedSession, type SessionState } from './session-state';
import { sessionKey, sessionUserKey, sessionStore } from './session-store';

export async function bufferSessionUpdate(
  projectId: bigint,
  id: string,
  at: string,
  session?: ClickhouseSession,
  explicitDuration?: number,
) {
  const key = sessionKey(projectId, id);
  for (let attempt = 0; attempt < 100; attempt++) {
    const { raw, state } = await sessionStore.load(key);
    if (state.deleted) return;
    const incoming = session ? storedSession(session) : undefined;
    if (incoming) incoming.id = id;
    // Tracking updates preserve ownership already assigned to this session.
    if (incoming && state.session) {
      incoming.id = state.session.id;
      incoming.userId = state.session.userId;
    }
    const next = combineSession(state, incoming, at, explicitDuration);
    if (JSON.stringify(next) === raw) return;
    if (await sessionStore.commitIfUnchanged([{ key, raw, state: next }])) return;
  }
  throw new Error('Session update contention; retry job');
}

// The common path needs no ClickHouse/user lookup or repeated UA/referrer parsing.
// Earlier arrivals still take the full path to correct the entry metadata.
export async function bufferExistingSessionActivity(projectId: bigint, id: string, at: string, geoData?: GeoData) {
  at = formatClickhouseDate(new Date(clickhouseDateToISO(at)));
  const key = sessionKey(projectId, id);
  for (let attempt = 0; attempt < 100; attempt++) {
    const { raw, state } = await sessionStore.load(key);
    if (state.deleted) return true;
    if (!state.session || at < state.session.startedAt) return false;
    const incoming = geoData ? { ...state.session, ...geoData } : undefined;
    const next = combineSession(state, incoming, at);
    if (JSON.stringify(next) === raw) return true;
    if (await sessionStore.commitIfUnchanged([{ key, raw, state: next }])) return true;
  }
  throw new Error('Session activity contention; retry job');
}

export async function getBufferedSessions(projectId: bigint, userId: bigint, persisted: ClickhouseSession[]) {
  const persistedByKey = new Map(persisted.map((s) => [sessionKey(projectId, s.id), s]));
  // Load persisted IDs as well: ownership changes can remove a key from the old user's Redis index.
  const keys = Array.from(
    new Set([
      ...(await stateRedis().smembers(sessionUserKey(projectId, userId))),
      ...Array.from(persistedByKey.keys()),
    ]),
  );
  // One mget instead of a get per key; only Redis-index-only keys can need a point load below.
  const cachedValues = keys.length ? await stateRedis().mget(...keys) : [];
  const result = new Map<string, ClickhouseSession>();

  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]!;
    const cached = cachedValues[index];
    let state: SessionState | undefined;
    if (cached) {
      state = JSON.parse(cached) as SessionState;
    } else {
      // No Redis override: the already-resolved persisted row is authoritative, so avoid a ClickHouse point query.
      const stored = persistedByKey.get(key);
      if (stored) {
        result.set(stored.id, stored);
        continue;
      }
      state = (await sessionStore.load(key)).state;
    }

    if (state.session && !state.deleted && state.session.userId === String(userId)) {
      result.set(state.session.id, publicSession(state.session));
    }
  }

  return Array.from(result.values());
}

// A Redis placeholder or early activity indicates processing may have started but has not
// initialized the session yet. An absent key may be a historical event that never had
// a session; loading it from ClickHouse here would create a placeholder and hide that distinction.
export async function findPendingSession(projectId: bigint, ids: Iterable<string>) {
  const uniqueIds = Array.from(new Set(ids));
  for (let offset = 0; offset < uniqueIds.length; offset += 500) {
    const batch = uniqueIds.slice(offset, offset + 500);
    const values = await stateRedis().mget(...batch.map((id) => sessionKey(projectId, id)));
    for (let index = 0; index < batch.length; index++) {
      const raw = values[index];
      if (!raw) continue;
      const state = JSON.parse(raw) as SessionState;
      if (!state.session && !state.deleted) return batch[index];
    }
  }
  return undefined;
}

export async function moveBufferedSession(
  projectId: bigint,
  sourceId: string,
  targetId: string,
  userId: bigint,
  identifier: string,
  displayName?: string,
) {
  const sourceKey = sessionKey(projectId, sourceId);
  const targetKey = sessionKey(projectId, targetId);
  for (let attempt = 0; attempt < 100; attempt++) {
    const source = await sessionStore.load(sourceKey);
    // A completed move leaves a tombstone. Retrying must not apply its stale source again.
    if (source.state.deleted) return;
    const target = sourceKey === targetKey ? source : await sessionStore.load(targetKey);
    // Recheck inside the CAS loop; never assign ownership to an unfinished session.
    if (!source.state.session || !target.state.session) throw new Error('Session is not initialized for merge');
    let next = combineSession(target.state, undefined, source.state.latestAt);
    if (next.deleted) throw new Error('Cannot merge into a deleted session');
    if (source.state.session && sourceKey !== targetKey) {
      const incoming = {
        ...source.state.session,
        id: targetKey.slice(sessionKey(projectId, '').length),
        userId: String(userId),
      };
      next = combineSession(next, incoming, source.state.latestAt);
    }

    next.session!.userId = String(userId);
    next.session!.userIdentifier = identifier;
    next.session!.userDisplayName = displayName ?? next.session!.userDisplayName;
    const entries = [{ key: targetKey, raw: target.raw, state: next }];
    if (sourceKey !== targetKey)
      entries.push({ key: sourceKey, raw: source.raw, state: { ...source.state, deleted: true } });
    if (await sessionStore.commitIfUnchanged(entries)) return;
  }
  throw new Error('Session merge contention; retry job');
}

export async function deleteBufferedSession(projectId: bigint, id: string) {
  const key = sessionKey(projectId, id);
  for (let attempt = 0; attempt < 100; attempt++) {
    const { raw, state } = await sessionStore.load(key);
    if (!state.latestAt) state.latestAt = new Date().toISOString().replace('T', ' ').replace('Z', '');
    if (state.deleted) return;
    if (await sessionStore.commitIfUnchanged([{ key, raw, state: { ...state, deleted: true } }])) return;
  }
  throw new Error('Session deletion contention; retry');
}
