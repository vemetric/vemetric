import type { Organization, OrganizationRole } from '@prisma/client';
import { prismaClient } from '../client';
import { generateOrganizationId } from '../utils/id';
export { OrganizationRole } from '@prisma/client';

export type { Organization };

export const dbOrganization = {
  create: (name: string) => prismaClient.organization.create({ data: { id: generateOrganizationId(), name } }),
  addUser: (organizationId: string, userId: string, role: OrganizationRole) =>
    prismaClient.userOrganization.create({ data: { organizationId, userId, role } }),
  findById: (id: string) => prismaClient.organization.findUnique({ where: { id }, include: { billingInfo: true } }),
  getUserOrganizations: (userId: string, includeOrganization: boolean = false) =>
    prismaClient.userOrganization.findMany({
      where: { userId },
      include: { organization: includeOrganization },
    }),
  getOrganizationUsers: (organizationId: string) =>
    prismaClient.userOrganization.findMany({ where: { organizationId } }),
  hasUserAccess: async (organizationId: string, userId: string, role?: OrganizationRole) => {
    const count = await prismaClient.userOrganization.count({ where: { userId, organizationId, role } });
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
  countUserFreeAdminOrganizations: async (userId: string) => {
    const count = await prismaClient.userOrganization.count({
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
};
