import type { Organization, OrganizationRole } from '@prisma/client';
import { type DbClient, prismaClient } from '../client';
import { generateOrganizationId } from '../utils/id';
export { OrganizationRole } from '@prisma/client';

export type { Organization };

export const dbOrganization = {
  create: ({ name, client = prismaClient }: { name: string; client?: DbClient }) =>
    client.organization.create({ data: { id: generateOrganizationId(), name } }),

  addUser: ({
    organizationId,
    userId,
    role,
    client = prismaClient,
  }: {
    organizationId: string;
    userId: string;
    role: OrganizationRole;
    client?: DbClient;
  }) => client.userOrganization.create({ data: { organizationId, userId, role } }),

  findById: (id: string) => prismaClient.organization.findUnique({ where: { id }, include: { billingInfo: true } }),

  getUserOrganizationsWithProjects: (userId: string) =>
    prismaClient.userOrganization.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            project: {
              where: {
                OR: [
                  // Project is explicitly in the user's access list
                  { userProjectAccess: { some: { userId } } },
                  // OR no access restrictions exist for this user in this organization
                  { organization: { userProjectAccess: { none: { userId } } } },
                ],
              },
            },
          },
        },
      },
    }),

  getOrganizationUsers: (organizationId: string) =>
    prismaClient.userOrganization.findMany({ where: { organizationId } }),

  getOrganizationUsersWithDetails: (organizationId: string) =>
    prismaClient.userOrganization.findMany({
      where: { organizationId },
      include: {
        user: {
          include: {
            projectAccess: {
              where: { organizationId },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),

  getSingleUserOrganization: ({
    organizationId,
    userId,
    client = prismaClient,
  }: {
    organizationId: string;
    userId: string;
    client?: DbClient;
  }) =>
    client.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    }),

  removeUser: ({
    organizationId,
    userId,
    client = prismaClient,
  }: {
    organizationId: string;
    userId: string;
    client?: DbClient;
  }) =>
    client.userOrganization.delete({
      where: { userId_organizationId: { userId, organizationId } },
    }),

  updateUserRole: ({
    organizationId,
    userId,
    role,
    client = prismaClient,
  }: {
    organizationId: string;
    userId: string;
    role: OrganizationRole;
    client?: DbClient;
  }) =>
    client.userOrganization.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role },
    }),
  hasUserAccess: async (organizationId: string, userId: string, role?: OrganizationRole, client: DbClient = prismaClient) => {
    const count = await client.userOrganization.count({
      where: role ? { userId, organizationId, role } : { userId, organizationId },
    });
    return count > 0;
  },
  update: (id: string, data: Partial<Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>>) =>
    prismaClient.organization.update({
      where: { id },
      data,
    }),

  /**
   * Count the number of free organizations where the user is an admin.
   * An organization is "free" if:
   * - It has no billingInfo record, OR
   * - It has billingInfo but subscriptionStatus is not 'active' or 'past_due'
   */
  countUserFreeAdminOrganizations: async ({ userId, client = prismaClient }: { userId: string; client?: DbClient }) => {
    const count = await client.userOrganization.count({
      where: {
        userId,
        role: 'ADMIN',
        OR: [
          {
            organization: {
              billingInfo: null,
            },
          },
          {
            organization: {
              billingInfo: {
                subscriptionStatus: {
                  notIn: ['active', 'past_due'],
                },
              },
            },
          },
        ],
      },
    });
    return count;
  },
  countMembers: ({
    organizationId,
    userId,
    client = prismaClient,
  }: {
    organizationId: string;
    userId?: string;
    client?: DbClient;
  }) => client.userOrganization.count({ where: userId ? { organizationId, userId } : { organizationId } }),
};
