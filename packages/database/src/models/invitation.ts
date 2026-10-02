import type { Invitation, OrganizationRole } from '@prisma/client';
import { INVITATION_EXPIRY_MS } from '@vemetric/common/invitation';
import { type DbClient, prismaClient } from '../client';
import { generateToken } from '../utils/id';

export type { Invitation };

export const dbInvitation = {
  create: ({
    organizationId,
    createdById,
    role,
    client = prismaClient,
  }: {
    organizationId: string;
    createdById: string;
    role: OrganizationRole;
    client?: DbClient;
  }) =>
    client.invitation.create({
      data: {
        token: generateToken(),
        organizationId,
        createdById,
        role,
      },
    }),

  findByToken: (token: string, skipExpiryCheck = false) =>
    prismaClient.invitation.findFirst({
      where: {
        token,
        createdAt: skipExpiryCheck ? undefined : { gt: new Date(Date.now() - INVITATION_EXPIRY_MS) },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

  /**
   * Consumes a pending invitation by deleting its row, and reports whether this call was the
   * one that consumed it.
   *
   * The conditional delete is the compare-and-set: the expiry check and the delete are a
   * single statement, so two concurrent signups carrying the same invitation link cannot both
   * see a pending invitation. Exactly one of them deletes a row and gets `true`, the other
   * gets `false`.
   *
   * Pending means the same thing it means everywhere else in the invite flow: the row still
   * exists, since accepting or revoking an invitation deletes it, and it was created within
   * `INVITATION_EXPIRY_MS`.
   *
   * Deleting the invitation cascades to its `InvitationProjectAccess` rows, so any caller that
   * still needs the granted project ids has to read them before calling this.
   * @param token Invitation token taken from an untrusted request.
   * @param client Optional transaction client.
   * @returns true if this call consumed a pending, non expired invitation.
   */
  consumePending: async ({ token, client = prismaClient }: { token: string; client?: DbClient }): Promise<boolean> => {
    const { count } = await client.invitation.deleteMany({
      where: {
        token,
        createdAt: { gt: new Date(Date.now() - INVITATION_EXPIRY_MS) },
      },
    });

    return count === 1;
  },

  listByOrganizationWithProjectAccess: (organizationId: string) =>
    prismaClient.invitation.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        projectAccess: {
          select: {
            projectId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

  delete: ({ token, client = prismaClient }: { token: string; client?: DbClient }) =>
    client.invitation.delete({ where: { token } }),

  countPendingByOrganization: ({
    organizationId,
    client = prismaClient,
  }: {
    organizationId: string;
    client?: DbClient;
  }) =>
    client.invitation.count({
      where: {
        organizationId,
        createdAt: { gt: new Date(Date.now() - INVITATION_EXPIRY_MS) },
      },
    }),
};
