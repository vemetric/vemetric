import type { ProjectRole } from '@prisma/client';
import { prismaClient } from '../client';
import { generateProjectId, generateToken } from '../utils/id';
export { ProjectRole, type Project } from '@prisma/client';

export const dbProject = {
  create: (name: string, domain: string, organizationId: string) =>
    prismaClient.project.create({
      data: { id: String(generateProjectId()), name, domain, token: generateToken(), organizationId },
    }),
  addUser: (projectId: string, userId: string, role: ProjectRole) =>
    prismaClient.userProject.create({ data: { projectId, userId, role } }),
  findAll: () => prismaClient.project.findMany(),
  countActive: () => prismaClient.project.count({ where: { firstEventAt: { not: null } } }),
  findByUserId: (userId: string) =>
    prismaClient.userProject.findMany({
      where: { userId },
      include: {
        project: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
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
  hasUserAccess: async (projectId: string, userId: string) => {
    const count = await prismaClient.userProject.count({ where: { userId, projectId } });
    return count > 0;
  },
};
