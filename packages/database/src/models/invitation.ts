import type { Invitation, OrganizationRole } from '@prisma/client';
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

  findByToken: (token: string) =>
    prismaClient.invitation.findUnique({
      where: { token },
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
};
