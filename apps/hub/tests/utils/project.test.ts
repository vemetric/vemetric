import { dbProject } from 'database';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { getProjectByToken } from '../../src/utils/project';

vi.mock('database', () => ({
  dbProject: {
    findByToken: vi.fn(),
  },
}));

describe('getProjectByToken', () => {
  const mockHeader = vi.fn() as Mock;
  const mockContext = {
    req: {
      header: mockHeader,
      path: '/e',
    },
  } as unknown as Context;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHeader.mockReturnValue(undefined);
    (dbProject.findByToken as Mock).mockResolvedValue({ id: '123' });
  });

  it('looks up the project by the token header', async () => {
    mockHeader.mockReturnValue('abc');

    await expect(getProjectByToken(mockContext, {})).resolves.toEqual({ id: '123' });
    expect(dbProject.findByToken).toHaveBeenCalledWith('abc');
  });

  it('falls back to the token in the body', async () => {
    await expect(getProjectByToken(mockContext, { Token: 'abc' })).resolves.toEqual({ id: '123' });
    expect(dbProject.findByToken).toHaveBeenCalledWith('abc');
  });

  it.each([{ startsWith: 'a' }, { gt: '' }, ['abc'], 123])(
    'rejects a non-string body token (%j) without querying the database',
    async (token) => {
      await expect(getProjectByToken(mockContext, { Token: token })).rejects.toBeInstanceOf(HTTPException);
      expect(dbProject.findByToken).not.toHaveBeenCalled();
    },
  );
});
