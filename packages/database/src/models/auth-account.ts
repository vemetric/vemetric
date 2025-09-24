import { prismaClient } from '../client';

export const dbAuthAccount = {
  findProviderByUserId: async (userId: string) => {
    const account = await prismaClient.account.findFirst({
      where: { userId },
      select: { providerId: true },
    });
    return account?.providerId ?? 'email';
  },
};
