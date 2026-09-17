import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbBootstrapLock } from '../src/models/bootstrap-lock';

const { createMock, deleteManyMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  deleteManyMock: vi.fn(),
}));

vi.mock('../src/client', () => ({
  prismaClient: {
    bootstrapLock: {
      create: createMock,
      deleteMany: deleteManyMock,
    },
  },
  PrismaClientKnownRequestError: Prisma.PrismaClientKnownRequestError,
}));

/** Builds the error Postgres reports for a violated primary key, which is how the lock is lost. */
function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
  });
}

describe('dbBootstrapLock.tryAcquire', () => {
  beforeEach(() => {
    createMock.mockReset();
    deleteManyMock.mockReset();
  });

  it('claims the lock by inserting the single fixed row', async () => {
    createMock.mockResolvedValue({ id: 'bootstrap' });

    await expect(dbBootstrapLock.tryAcquire()).resolves.toBe(true);
    expect(createMock).toHaveBeenCalledWith({ data: { id: 'bootstrap' } });
  });

  it('reports a lost race instead of throwing on a duplicate insert', async () => {
    createMock.mockRejectedValue(uniqueConstraintError());

    await expect(dbBootstrapLock.tryAcquire()).resolves.toBe(false);
  });

  it('propagates every other database error', async () => {
    createMock.mockRejectedValue(new Error('connection refused'));

    await expect(dbBootstrapLock.tryAcquire()).rejects.toThrowError('connection refused');
  });
});

describe('dbBootstrapLock.reclaimIfStale', () => {
  beforeEach(() => {
    createMock.mockReset();
    deleteManyMock.mockReset();
  });

  it('deletes only a lock that is older than the stale threshold', async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });
    createMock.mockResolvedValue({ id: 'bootstrap' });

    const before = Date.now();
    await expect(dbBootstrapLock.reclaimIfStale()).resolves.toBe(true);

    const where = deleteManyMock.mock.calls[0][0].where;
    expect(where.id).toBe('bootstrap');
    // 30 seconds is the window in which a lock may still belong to an in-flight signup.
    expect(where.createdAt.lt.getTime()).toBeGreaterThanOrEqual(before - 30_000);
    expect(where.createdAt.lt.getTime()).toBeLessThanOrEqual(Date.now() - 30_000);
  });

  it('backs off when another caller deleted the stale lock first', async () => {
    deleteManyMock.mockResolvedValue({ count: 0 });

    await expect(dbBootstrapLock.reclaimIfStale()).resolves.toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('does not report a reclaim when the row it deleted is immediately taken again', async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });
    createMock.mockRejectedValue(uniqueConstraintError());

    await expect(dbBootstrapLock.reclaimIfStale()).resolves.toBe(false);
  });
});
