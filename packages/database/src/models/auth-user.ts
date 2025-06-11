import { prismaClient } from '../client';

export const dbAuthUser = {
  updateName: (userId: string, name: string) => prismaClient.user.update({ where: { id: userId }, data: { name } }),
};
