import type { Invitation, OrganizationRole } from '@prisma/client';
import { INVITATION_EXPIRY_MS } from '@vemetric/common/organization';
import { prismaClient } from '../client';
import { generateToken } from '../utils/id';

export type { Invitation };

export const dbInvitation = {
  create: (organizationId: string, createdById: string, role: OrganizationRole) =>
    prismaClient.invitation.create({
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

  listByOrganization: (organizationId: string) =>
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
      },
      orderBy: { createdAt: 'desc' },
    }),

  delete: (token: string) => prismaClient.invitation.delete({ where: { token } }),

  countPendingByOrganization: (organizationId: string) =>
    prismaClient.invitation.count({
      where: {
        organizationId,
        createdAt: { gt: new Date(Date.now() - INVITATION_EXPIRY_MS) },
      },
    }),
};
