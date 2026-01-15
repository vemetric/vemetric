import type { DbClient } from '../client';
import { prismaClient } from '../client';

export const dbUserProjectAccess = {
  getUserProjectIds: async (userId: string, organizationId: string): Promise<string[]> => {
    const access = await prismaClient.userProjectAccess.findMany({
      where: { userId, organizationId },
      select: { projectId: true },
    });
    return access.map((a) => a.projectId);
  },

  setUserProjectAccess: async ({
    userId,
    organizationId,
    projectIds,
    client = prismaClient,
  }: {
    userId: string;
    organizationId: string;
    projectIds: string[];
    client?: DbClient;
  }): Promise<void> => {
    // Delete all existing access entries for this user in this organization
    await client.userProjectAccess.deleteMany({
      where: { userId, organizationId },
    });

    // If projectIds has values, create explicit access entries, else it means no access restrictions
    if (projectIds.length > 0) {
      await client.userProjectAccess.createMany({
        data: projectIds.map((projectId) => ({
          userId,
          projectId,
          organizationId,
        })),
      });
    }
  },

  removeAllRestrictions: ({
    userId,
    organizationId,
    client = prismaClient,
  }: {
    userId: string;
    organizationId: string;
    client?: DbClient;
  }) =>
    client.userProjectAccess.deleteMany({
      where: { userId, organizationId },
    }),
};
