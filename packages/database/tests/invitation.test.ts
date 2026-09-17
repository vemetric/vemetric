import { INVITATION_EXPIRY_MS } from '@vemetric/common/invitation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../src/client';
import { dbInvitation } from '../src/models/invitation';

const { deleteManyMock } = vi.hoisted(() => ({
  deleteManyMock: vi.fn(),
}));

vi.mock('../src/client', () => ({
  prismaClient: {
    invitation: {
      deleteMany: deleteManyMock,
    },
  },
}));

describe('dbInvitation.consumePending', () => {
  const token = 'aBcDeFgH12345678';

  beforeEach(() => {
    deleteManyMock.mockReset();
  });

  it('deletes the invitation and reports that this caller consumed it', async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });

    await expect(dbInvitation.consumePending({ token })).resolves.toBe(true);
    expect(deleteManyMock).toHaveBeenCalledTimes(1);
  });

  it('reports a lost race when no row was deleted', async () => {
    deleteManyMock.mockResolvedValue({ count: 0 });

    await expect(dbInvitation.consumePending({ token })).resolves.toBe(false);
  });

  it('restricts the delete to that token and to invitations within the expiry window', async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });

    const before = Date.now();
    await dbInvitation.consumePending({ token });

    const where = deleteManyMock.mock.calls[0][0].where;
    expect(where.token).toBe(token);
    expect(where.createdAt.gt.getTime()).toBeGreaterThanOrEqual(before - INVITATION_EXPIRY_MS);
    expect(where.createdAt.gt.getTime()).toBeLessThanOrEqual(Date.now() - INVITATION_EXPIRY_MS);
  });

  it('runs on the transaction client when one is passed', async () => {
    const transactionDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = { invitation: { deleteMany: transactionDeleteMany } };

    await expect(dbInvitation.consumePending({ token, client: client as unknown as DbClient })).resolves.toBe(true);
    expect(transactionDeleteMany).toHaveBeenCalledTimes(1);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });
});
