import { prismaClient } from '../client';

export const dbAuthAccount = {
  findProviderByUserId: async (userId: string) => {
    const account = await prismaClient.account.findFirst({
      where: { userId },
      select: { provider: true },
    });
    return account?.provider ?? 'email';
  },
};
