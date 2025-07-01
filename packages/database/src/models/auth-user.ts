import type { User } from '@prisma/client';
import { prismaClient } from '../client';

export type { User };

export const dbAuthUser = {
  updateName: (userId: string, name: string) => prismaClient.user.update({ where: { id: userId }, data: { name } }),
  update: (id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>) =>
    prismaClient.user.update({
      where: { id },
      data,
    }),
};
