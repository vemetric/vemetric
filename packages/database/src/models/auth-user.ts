import type { User, Account } from '@prisma/client';
import { prismaClient } from '../client';

export type { User, Account };

export const dbAuthUser = {
  updateName: (userId: string, name: string) => prismaClient.user.update({ where: { id: userId }, data: { name } }),
  update: (id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'receiveEmailTips'>>) =>
    prismaClient.user.update({
      where: { id },
      data,
    }),
  getLinkedAccounts: (userId: string) =>
    prismaClient.account.findMany({
      where: { userId },
      select: {
        id: true,
        providerId: true,
        accountId: true,
        createdAt: true,
      },
    }),
};
