import { Prisma, PrismaClient } from '@prisma/client';

export const prismaClient = new PrismaClient();

export const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;
