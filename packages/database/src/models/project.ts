import { prismaClient } from '../client';
import { generateProjectId, generateToken } from '../utils/id';
export { type Project } from '@prisma/client';

export const dbProject = {
  create: (name: string, domain: string, organizationId: string) =>
    prismaClient.project.create({
      data: { id: String(generateProjectId()), name, domain, token: generateToken(), organizationId },
    }),
  findAll: () => prismaClient.project.findMany(),
  findByDomain: (domain: string) =>
    prismaClient.project.findFirst({
      where: { domain },
    }),
  findByToken: (token: string) =>
    prismaClient.project.findFirst({
      where: { token },
    }),
  findById: (id: string) =>
    prismaClient.project.findFirst({
      where: { id },
    }),
  findByOrganizationId: (organizationId: string) =>
    prismaClient.project.findMany({
      where: { organizationId },
    }),
  update: (
    id: string,
    data: Partial<{
      name: string;
      publicDashboard: boolean;
      eventIcons: Record<string, string>;
      excludedIps: string | null;
      excludedCountries: string | null;
    }>,
  ) =>
    prismaClient.project.update({
      where: { id },
      data,
    }),
  hasUserAccess: async (userId: string, projectId: string, organizationId: string): Promise<boolean> => {
    // Get all project access entries for this user in this organization
    const userProjectAccess = await prismaClient.userProjectAccess.findMany({
      where: { userId, organizationId },
    });

    // No restrictions configured, user has full access to all projects
    if (userProjectAccess.length === 0) {
      return true;
    }

    return userProjectAccess.some((access) => access.projectId === projectId);
  },
};
