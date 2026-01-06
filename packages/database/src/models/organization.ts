import type { Organization, OrganizationRole, Project } from '@prisma/client';
import { prismaClient } from '../client';
import { generateOrganizationId } from '../utils/id';
export { OrganizationRole } from '@prisma/client';

export type { Organization };

export const dbOrganization = {
  create: (name: string) => prismaClient.organization.create({ data: { id: generateOrganizationId(), name } }),
  addUser: (organizationId: string, userId: string, role: OrganizationRole) =>
    prismaClient.userOrganization.create({ data: { organizationId, userId, role } }),
  findById: (id: string) => prismaClient.organization.findUnique({ where: { id }, include: { billingInfo: true } }),
  getUserOrganizationsWithProjects: (userId: string) =>
    prismaClient.userOrganization.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            project: true,
          },
        },
      },
    }),
  getOrganizationUsers: (organizationId: string) =>
    prismaClient.userOrganization.findMany({ where: { organizationId } }),
  hasUserAccess: async (organizationId: string, userId: string, role?: OrganizationRole) => {
    const count = await prismaClient.userOrganization.count({
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
  filterProjectsByUserAccess: async <T extends Pick<Project, 'id' | 'organizationId'>>(
    userId: string,
    projects: T[],
  ): Promise<T[]> => {
    if (projects.length === 0) return [];

    // Get all project access entries for this user (organizationId is now directly on the table)
    const userProjectAccess = await prismaClient.userProjectAccess.findMany({
      where: { userId },
      select: { projectId: true, organizationId: true },
    });

    // Group by organization: Map<organizationId, Set<projectId>>
    const accessByOrg = new Map<string, Set<string>>();
    for (const access of userProjectAccess) {
      if (!accessByOrg.has(access.organizationId)) {
        accessByOrg.set(access.organizationId, new Set());
      }
      accessByOrg.get(access.organizationId)!.add(access.projectId);
    }

    // Filter projects
    return projects.filter((project) => {
      const orgRestrictions = accessByOrg.get(project.organizationId);

      // No restrictions for this org → full access
      if (!orgRestrictions || orgRestrictions.size === 0) return true;

      // Has restrictions → check if project is in allowed list
      return orgRestrictions.has(project.id);
    });
  },
};
