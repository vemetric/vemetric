import { Prisma, PrismaClient } from '@prisma/client';

export const prismaClient = new PrismaClient();

export const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;

// Type for transaction client - can be used as optional parameter in db functions
export type DbClient = PrismaClient | Prisma.TransactionClient;

export async function serializableTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return await prismaClient.$transaction(fn, { isolationLevel: 'Serializable' });
}
