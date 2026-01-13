import { prismaClient } from '../client';

export const dbUserProjectAccess = {
  getUserProjectIds: async (userId: string, organizationId: string): Promise<string[]> => {
    const access = await prismaClient.userProjectAccess.findMany({
      where: { userId, organizationId },
      select: { projectId: true },
    });
    return access.map((a) => a.projectId);
  },

  setUserProjectAccess: async (userId: string, organizationId: string, projectIds: string[]): Promise<void> => {
    await prismaClient.$transaction(async (tx) => {
      // Delete all existing access entries for this user in this organization
      await tx.userProjectAccess.deleteMany({
        where: { userId, organizationId },
      });

      // If projectIds has values, create explicit access entries, else it means no access restrictions
      if (projectIds.length > 0) {
        await tx.userProjectAccess.createMany({
          data: projectIds.map((projectId) => ({
            userId,
            projectId,
            organizationId,
          })),
        });
      }
    });
  },

  removeAllRestrictions: (userId: string, organizationId: string) =>
    prismaClient.userProjectAccess.deleteMany({
      where: { userId, organizationId },
    }),
};
