import { clickhouseUser } from 'clickhouse';
import { applyUserOp, toClickhouseUser, type StoredUser, type UserOp } from './user-state';
import { userKey, userStore } from './user-store';
import { invalidateIngestionUser } from '../utils/user-cache';

/**
 * The single write path for users (create, update, enrich). Each change is a compare-and-set of the
 * user's Redis state, so concurrent jobs on any replica never lose an update; the flusher writes
 * the full current row to ClickHouse.
 */
export async function upsertUser(projectId: bigint, userId: bigint, op: UserOp) {
  const key = userKey(projectId, userId);
  const ids = { projectId: String(projectId), userId: String(userId) };
  for (let attempt = 0; attempt < 100; attempt++) {
    const { raw, state } = await userStore.load(key);
    const next = applyUserOp(state, op, ids);
    if (!next) return;
    if (await userStore.commitIfUnchanged({ key, raw, state: next.state }, next.dirty)) {
      if (next.dirty) await invalidateIngestionUser(projectId, userId);
      return;
    }
  }
  throw new Error('User update contention; retry job');
}

/** The current user, including changes the flusher has not written yet. */
export async function getUser(projectId: bigint, userId: bigint): Promise<StoredUser | null> {
  return (await userStore.load(userKey(projectId, userId))).state.user ?? null;
}

// Called by the scheduled flusher; a failed write leaves the users dirty for the next tick.
export async function flushUserBuffer(limit = 500) {
  if (!Number.isSafeInteger(limit) || limit < 1) return 0;
  const snapshots = await userStore.readPending(limit);
  if (!snapshots.length) return 0;
  await clickhouseUser.insert(snapshots.map(({ state }) => toClickhouseUser(state.user!)));
  await userStore.acknowledgeFlush(snapshots);
  return snapshots.length;
}

export const pendingUserStats = () => userStore.pendingStats();
