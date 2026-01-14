import type { Salt } from '@prisma/client';
import { customId21 } from '@vemetric/common/id';
import { prismaClient } from '../client';
export { type Salt } from '@prisma/client';

export const dbSalt = {
  /**
   * Retrieves the latest two salts ordered by creation date.
   * The first salt in the array is the most recent one.
   * @returns Promise<Salt[]> Array containing up to 2 most recent salts
   */
  getLatestSalts: async (): Promise<{
    currentSalt: Salt | undefined;
    previousSalt: Salt | undefined;
  }> => {
    const [currentSalt, previousSalt] = await prismaClient.salt.findMany({
      take: 2,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      currentSalt,
      previousSalt,
    };
  },

  /**
   * Cleans up old salts by keeping only the 4 most recent ones and deleting the rest.
   * @returns Promise<number> The number of deleted salts
   */
  cleanupOldSalts: async (): Promise<number> => {
    return prismaClient.$transaction(async (tx) => {
      // Get IDs of the 4 most recent salts that we want to keep
      const saltsToKeep = await tx.salt.findMany({
        select: { id: true },
        take: 4,
        orderBy: {
          createdAt: 'desc',
        },
      });

      const keepIds = saltsToKeep.map((salt) => salt.id);

      // Delete all salts except the ones we want to keep
      const result = await tx.salt.deleteMany({
        where: {
          id: {
            notIn: keepIds,
          },
        },
      });

      return result.count;
    });
  },

  /**
   * Creates a new salt with a random value.
   * @returns Promise<Salt> The newly created salt
   */
  createSalt: async (): Promise<Salt> => {
    // Create a new salt entry with a random id
    return prismaClient.salt.create({
      data: {
        id: customId21(),
      },
    });
  },
};
