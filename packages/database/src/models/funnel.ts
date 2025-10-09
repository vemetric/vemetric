import { prismaClient } from '../client';
export { type Funnel } from '@prisma/client';

export const dbFunnel = {
  create: (data: { name: string; projectId: string; steps: any; icon?: string }) => prismaClient.funnel.create({ data }),

  findByProjectId: (projectId: string) =>
    prismaClient.funnel.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    }),

  findById: (id: string) =>
    prismaClient.funnel.findUnique({
      where: { id },
    }),

  update: (id: string, data: Partial<{ name: string; steps: any; icon?: string }>) =>
    prismaClient.funnel.update({
      where: { id },
      data,
    }),

  delete: (id: string) =>
    prismaClient.funnel.delete({
      where: { id },
    }),
};
