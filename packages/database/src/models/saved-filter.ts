import { prismaClient } from '../client';
export { type SavedFilter } from '@prisma/client';

export const dbSavedFilter = {
  create: (data: { name: string; projectId: string; filterConfig: any; icon: string | null }) =>
    prismaClient.savedFilter.create({ data }),

  findByProjectId: (projectId: string) =>
    prismaClient.savedFilter.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    }),

  findById: (id: string) =>
    prismaClient.savedFilter.findUnique({
      where: { id },
    }),

  update: (id: string, data: Partial<{ name: string; filterConfig: any; icon: string | null }>) =>
    prismaClient.savedFilter.update({
      where: { id },
      data,
    }),

  delete: (id: string) =>
    prismaClient.savedFilter.delete({
      where: { id },
    }),
};
