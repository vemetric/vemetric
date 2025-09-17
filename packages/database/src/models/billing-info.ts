import type { BillingInfo } from '@prisma/client';
import { prismaClient } from '../client';

export type { BillingInfo };

export const dbBillingInfo = {
  upsert: async ({
    createdAt,
    transactionId,
    ...data
  }: Omit<BillingInfo, 'createdAt' | 'transactionId'> & Partial<Pick<BillingInfo, 'createdAt' | 'transactionId'>>) => {
    return prismaClient.billingInfo.upsert({
      where: { organizationId: data.organizationId },
      create: { ...data, createdAt: createdAt || new Date(), transactionId: transactionId || '' },
      update: { ...data, createdAt: createdAt, transactionId: transactionId },
    });
  },
  findByOrganizationId: async (organizationId: string) => {
    return prismaClient.billingInfo.findFirst({
      where: { organizationId },
    });
  },
};
