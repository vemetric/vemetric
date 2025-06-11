import type { BillingInfo } from '@prisma/client';
import { prismaClient } from '../client';

export type { BillingInfo };

export const dbBillingInfo = {
  create: async (data: Omit<BillingInfo, 'createdAt'>) => {
    return prismaClient.billingInfo.create({
      data,
    });
  },
  update: async (data: Partial<Omit<BillingInfo, 'organizationId'>> & { organizationId: string }) => {
    return prismaClient.billingInfo.update({
      where: { organizationId: data.organizationId },
      data,
    });
  },
  findByOrganizationId: async (organizationId: string) => {
    return prismaClient.billingInfo.findFirst({
      where: { organizationId },
    });
  },
};
