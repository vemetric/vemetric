import { TRPCError } from '@trpc/server';
import type { DbClient } from 'database';
import { prismaClient } from 'database';

export async function transaction<T>(
  fn: (tx: DbClient) => Promise<T>,
  options?: { isolationLevel?: 'Serializable' },
): Promise<T> {
  try {
    return await prismaClient.$transaction(fn, options);
  } catch (error) {
    if (error instanceof Error && error.cause instanceof TRPCError) {
      throw error.cause;
    }

    throw error;
  }
}

export async function serializableTransaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
  return await transaction(fn, { isolationLevel: 'Serializable' });
}
