import { type DbClient, prismaClient } from '../client';
export { type ClickhouseDeletion } from '@prisma/client';

export type ClickhouseDeletionReason = 'project-deleted' | 'account-deleted' | 'user-deleted' | 'orphaned';

// ClickHouse data waiting to be deleted by the worker (clickhouse-deletion-worker). Queue it in the same transaction
// that deletes the Postgres side, so nothing is left behind if one of them fails.
export const dbClickhouseDeletion = {
  /** All analytics data of a project. */
  queueProject: (projectId: string, reason: ClickhouseDeletionReason, client: DbClient = prismaClient) =>
    client.clickhouseDeletion.create({ data: { projectId, reason } }),

  /** The data of single analytics users of a project (ClickHouse `userId`, `id` in the `user` table). */
  queueUsers: (
    projectId: string,
    userIds: string[],
    reason: ClickhouseDeletionReason,
    client: DbClient = prismaClient,
  ) => client.clickhouseDeletion.create({ data: { projectId, userIds, reason } }),

  findById: (id: string) => prismaClient.clickhouseDeletion.findUnique({ where: { id } }),

  /** Queued at least `minAgeMs` ago and not deleted yet (including ones that failed before). */
  findPending: (minAgeMs: number) =>
    prismaClient.clickhouseDeletion.findMany({
      where: { deletedAt: null, createdAt: { lte: new Date(Date.now() - minAgeMs) } },
      orderBy: { createdAt: 'asc' },
    }),

  markDeleted: (ids: string[]) =>
    prismaClient.clickhouseDeletion.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date(), error: null },
    }),

  markFailed: (ids: string[], error: string) =>
    prismaClient.clickhouseDeletion.updateMany({ where: { id: { in: ids } }, data: { error } }),

  /** Deleted (rows marked in ClickHouse) but not physically removed yet. */
  countUnpurged: () => prismaClient.clickhouseDeletion.count({ where: { deletedAt: { not: null }, purgedAt: null } }),

  /** Marks everything deleted before `before` as physically removed. */
  markPurged: (before: Date) =>
    prismaClient.clickhouseDeletion.updateMany({
      where: { deletedAt: { not: null, lte: before }, purgedAt: null },
      data: { purgedAt: new Date() },
    }),

  /** Project ids that already have a whole-project deletion queued or done. */
  findQueuedProjectIds: async () =>
    (
      await prismaClient.clickhouseDeletion.findMany({
        where: { userIds: { isEmpty: true } },
        select: { projectId: true },
        distinct: ['projectId'],
      })
    ).map((deletion) => deletion.projectId),
};
