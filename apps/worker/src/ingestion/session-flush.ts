import { clickhouseSession, type ClickhouseSession } from 'clickhouse';
import { bufferSessionUpdate } from './session-buffer';
import { sessionKey, sessionKeyPrefix, sessionStore } from './session-store';

// One scheduled worker drains batches. Revisioned writes also tolerate a stalled job resuming late.
export async function flushSessionBuffer(limit = 500, onlyKeys?: string[]) {
  if (!Number.isSafeInteger(limit) || limit < 1) return 0;
  const snapshots = await sessionStore.readPending(limit, onlyKeys);
  if (!snapshots.length) return 0;
  await clickhouseSession.insertRevisions(
    snapshots.map(({ key, state }) => {
      const [projectId, ...id] = key.slice(sessionKeyPrefix.length).split(':');
      const sessionId = id.join(':');

      if (state.deleted) {
        return {
          projectId,
          id: sessionId,
          userId: state.session?.userId ?? '0',
          startedAt: (state.session?.startedAt ?? state.latestAt) || '1970-01-01 00:00:00.000',
          endedAt: (state.session?.endedAt ?? state.latestAt) || '1970-01-01 00:00:00.000',
          revision: String(state.revision),
          deleted: 1,
        };
      }

      return {
        ...(state.session ?? {
          projectId,
          id: sessionId,
          startedAt: state.latestAt || '1970-01-01 00:00:00.000',
          endedAt: state.latestAt || '1970-01-01 00:00:00.000',
          duration: 0,
        }),
        userId: state.session?.userId ?? '0',
        revision: String(state.revision),
        deleted: 0,
      };
    }),
  );
  // No marker is removed before ClickHouse acknowledges; failures remain available for retry.
  await sessionStore.acknowledgeFlush(snapshots);
  return snapshots.length;
}

// Preserve the synchronous insert API for imports and callers that need immediate query visibility.
// These bounded flushes use the same conditional acknowledgement as the scheduled worker.
export async function persistSessionUpdates(
  sessions: ClickhouseSession[],
  { preserveDuration = false }: { preserveDuration?: boolean } = {},
) {
  for (const session of sessions)
    await bufferSessionUpdate(
      session.projectId,
      session.id,
      session.endedAt,
      session,
      preserveDuration ? session.duration : undefined,
    );
  await flushSessionBuffer(
    sessions.length,
    sessions.map((s) => sessionKey(s.projectId, s.id)),
  );
}

export const pendingSessionStats = () => sessionStore.pendingStats();
