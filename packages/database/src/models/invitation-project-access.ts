import type { DbClient } from '../client';
import { prismaClient } from '../client';

export const dbInvitationProjectAccess = {
  getProjectIds: async (invitationToken: string, organizationId: string): Promise<string[]> => {
    const access = await prismaClient.invitationProjectAccess.findMany({
      where: { invitationToken, organizationId },
      select: { projectId: true },
    });
    return access.map((a) => a.projectId);
  },

  setProjectAccess: async ({
    invitationToken,
    organizationId,
    projectIds,
    client = prismaClient,
  }: {
    invitationToken: string;
    organizationId: string;
    projectIds: string[];
    client?: DbClient;
  }): Promise<void> => {
    // Delete all existing access entries for this invitation
    await client.invitationProjectAccess.deleteMany({
      where: { invitationToken, organizationId },
    });

    // If projectIds has values, create explicit access entries
    if (projectIds.length > 0) {
      await client.invitationProjectAccess.createMany({
        data: projectIds.map((projectId) => ({
          invitationToken,
          projectId,
          organizationId,
        })),
      });
    }
  },
};
