import { createUserQueue } from '@vemetric/queues/create-user-queue';
import { enrichUserQueue } from '@vemetric/queues/enrich-user-queue';
import { mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { updateUserQueue } from '@vemetric/queues/update-user-queue';
import { dbUserIdentificationMap, generateUserId } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HonoContext } from '../../src/types';
import { setUserIdCookie } from '../../src/utils/cookie';
import { continueSession } from '../../src/utils/session';
import { identifyUser } from '../../src/utils/user';

vi.mock('@vemetric/queues/queue-utils', () => ({
  addToQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@vemetric/queues/create-user-queue', () => ({
  createUserQueue: { name: 'create-user' },
}));

vi.mock('@vemetric/queues/update-user-queue', async () => {
  const { z } = await import('zod');
  return {
    updateUserQueue: { name: 'update-user' },
    updateUserDataModel: z.object({}).passthrough(),
  };
});

vi.mock('@vemetric/queues/enrich-user-queue', () => ({
  enrichUserQueue: { name: 'enrich-user' },
}));

vi.mock('@vemetric/queues/merge-user-queue', () => ({
  mergeUserQueue: { name: 'merge-user' },
  mergeUserJobOptions: { attempts: 25 },
}));

vi.mock('../../src/utils/cookie', () => ({
  setUserIdCookie: vi.fn(),
}));

vi.mock('../../src/utils/session', () => ({
  continueSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('database', () => ({
  dbUserIdentificationMap: {
    findByUserId: vi.fn(),
    findOrCreate: vi.fn(),
  },
  generateUserId: vi.fn(),
}));

describe('identifyUser', () => {
  const mockContext = {
    var: {
      allowCookies: true,
      geoData: undefined,
    },
  } as unknown as HonoContext;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbUserIdentificationMap.findByUserId).mockResolvedValue(null);
    vi.mocked(generateUserId).mockReturnValue(BigInt(900));
  });

  it('queues create-user and merge-user when findOrCreate creates the mapping', async () => {
    vi.mocked(dbUserIdentificationMap.findOrCreate).mockResolvedValue({
      record: { projectId: '123', userId: '900', identifier: 'alice@example.com' },
      created: true,
    });

    const userId = await identifyUser(
      mockContext,
      { identifier: 'alice@example.com', displayName: 'Alice' },
      BigInt(123),
      BigInt(500),
    );

    expect(userId).toBe(BigInt(900));
    expect(dbUserIdentificationMap.findOrCreate).toHaveBeenCalledWith('123', '900', 'alice@example.com');
    expect(addToQueue).toHaveBeenCalledWith(
      createUserQueue,
      expect.objectContaining({
        projectId: '123',
        userId: '900',
        identifier: 'alice@example.com',
        displayName: 'Alice',
      }),
      { jobId: '123-900' },
    );
    expect(addToQueue).toHaveBeenCalledWith(
      mergeUserQueue,
      expect.objectContaining({ projectId: '123', oldUserId: '500', newUserId: '900' }),
      expect.any(Object),
    );
    expect(addToQueue).not.toHaveBeenCalledWith(updateUserQueue, expect.anything());
    expect(addToQueue).not.toHaveBeenCalledWith(enrichUserQueue, expect.anything(), expect.anything());
    expect(continueSession).toHaveBeenCalledWith(BigInt(123), BigInt(500), BigInt(900), undefined);
    expect(setUserIdCookie).toHaveBeenCalledWith(mockContext, BigInt(900));
  });

  it('queues update-user, merge-user, and enrich-user when another request created the mapping first', async () => {
    vi.mocked(dbUserIdentificationMap.findOrCreate).mockResolvedValue({
      record: { projectId: '123', userId: '777', identifier: 'alice@example.com' },
      created: false,
    });

    const userId = await identifyUser(
      mockContext,
      { identifier: 'alice@example.com', displayName: 'Alice' },
      BigInt(123),
      BigInt(500),
    );

    expect(userId).toBe(BigInt(777));
    expect(addToQueue).not.toHaveBeenCalledWith(createUserQueue, expect.anything(), expect.anything());
    expect(addToQueue).toHaveBeenCalledWith(
      updateUserQueue,
      expect.objectContaining({ projectId: '123', userId: '777', displayName: 'Alice' }),
    );
    expect(addToQueue).toHaveBeenCalledWith(
      mergeUserQueue,
      expect.objectContaining({ projectId: '123', oldUserId: '500', newUserId: '777' }),
      expect.any(Object),
    );
    expect(addToQueue).toHaveBeenCalledWith(
      enrichUserQueue,
      { projectId: '123', userId: '777' },
      expect.objectContaining({ delay: 10000 }),
    );
    expect(setUserIdCookie).toHaveBeenCalledWith(mockContext, BigInt(777));
  });
});
