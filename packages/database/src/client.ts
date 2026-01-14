import { Prisma, PrismaClient } from '@prisma/client';

export const prismaClient = new PrismaClient();

export const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;

// Type for transaction client - can be used as optional parameter in db functions
export type DbClient = PrismaClient | Prisma.TransactionClient;
