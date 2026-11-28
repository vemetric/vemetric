import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usersRouter } from './users';

const mocks = vi.hoisted(() => ({
  findProject: vi.fn(),
  hasOrganizationAccess: vi.fn(),
  hasProjectAccess: vi.fn(),
  findOrganization: vi.fn(),
  deleteIdentifications: vi.fn(),
  queueUsers: vi.fn(),
  queueUserDeletionJob: vi.fn(),
  trackEvent: vi.fn(),
  getLatestEventsByUserId: vi.fn(),
  findUserById: vi.fn(),
  findLatestSessionByUserId: vi.fn(),
  findSessionsByIds: vi.fn(),
  isSessionOnline: vi.fn(),
}));

vi.mock('database', () => ({
  dbProject: { findById: mocks.findProject, hasUserAccess: mocks.hasProjectAccess },
  dbOrganization: { hasUserAccess: mocks.hasOrganizationAccess, findById: mocks.findOrganization },
  dbUserIdentificationMap: { deleteByUserIds: mocks.deleteIdentifications },
  dbClickhouseDeletion: { queueUsers: mocks.queueUsers },
  dbFunnel: {},
  prismaClient: { $transaction: (fn: (tx: unknown) => unknown) => fn('tx') },
  OrganizationRole: { ADMIN: 'ADMIN', MEMBER: 'MEMBER' },
}));
vi.mock('@vemetric/queues/clickhouse-deletion-queue', () => ({ queueUserDeletionJob: mocks.queueUserDeletionJob }));
vi.mock('clickhouse', () => ({
  clickhouseEvent: { getLatestEventsByUserId: mocks.getLatestEventsByUserId },
  clickhouseUser: { findById: mocks.findUserById },
  clickhouseSession: {
    findLatestByUserId: mocks.findLatestSessionByUserId,
    findByIds: mocks.findSessionsByIds,
  },
  isSessionOnline: mocks.isSessionOnline,
}));
vi.mock('../utils/vemetric-client', () => ({ vemetric: { trackEvent: mocks.trackEvent } }));
vi.mock('../utils/billing', () => ({ getSubscriptionStatus: vi.fn().mockResolvedValue({ isActive: true }) }));
vi.mock('../utils/backend-logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const caller = usersRouter.createCaller({
  var: { user: { id: 'user_1', name: 'Admin' }, session: { id: 'session_1' } },
} as never);

describe('users.delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findProject.mockResolvedValue({ id: '42', domain: 'example.com', organizationId: 'org_1' });
    mocks.hasOrganizationAccess.mockResolvedValue(true);
    mocks.hasProjectAccess.mockResolvedValue(true);
    mocks.findOrganization.mockResolvedValue({ id: 'org_1' });
    mocks.queueUsers.mockResolvedValue({ id: 'deletion_1' });
  });

  it('removes the identification and queues the deletion in one transaction, then starts the job', async () => {
    expect(await caller.delete({ projectId: '42', userId: '123' })).toEqual({ success: true });

    expect(mocks.deleteIdentifications).toHaveBeenCalledWith('42', ['123'], 'tx');
    expect(mocks.queueUsers).toHaveBeenCalledWith('42', ['123'], 'user-deleted', 'tx');
    expect(mocks.queueUserDeletionJob).toHaveBeenCalled();
    expect(mocks.trackEvent).toHaveBeenCalledWith('UserDeleted', {
      userIdentifier: 'user_1',
      userDisplayName: 'Admin',
      eventData: { projectId: '42', projectDomain: 'example.com', userId: '123' },
    });
  });

  it('is only allowed for organization admins', async () => {
    mocks.hasOrganizationAccess.mockImplementation(async (_org: string, _user: string, role?: string) => !role);

    await expect(caller.delete({ projectId: '42', userId: '123' })).rejects.toThrow(
      'Only organization admins can perform this action',
    );
    expect(mocks.queueUsers).not.toHaveBeenCalled();
  });

  it('rejects user ids that are not numeric', async () => {
    await expect(caller.delete({ projectId: '42', userId: '1 OR 1=1' })).rejects.toThrow();
    expect(mocks.queueUsers).not.toHaveBeenCalled();
  });

  it('succeeds when the job cannot be queued, the nightly run deletes it then', async () => {
    mocks.queueUserDeletionJob.mockRejectedValue(new Error('redis down'));

    expect(await caller.delete({ projectId: '42', userId: '123' })).toEqual({ success: true });
    expect(mocks.queueUsers).toHaveBeenCalled();
  });
});

describe('users online status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findProject.mockResolvedValue({ id: '42', domain: 'example.com', organizationId: 'org_1' });
    mocks.hasOrganizationAccess.mockResolvedValue(true);
    mocks.hasProjectAccess.mockResolvedValue(true);
    mocks.findOrganization.mockResolvedValue({ id: 'org_1' });
  });

  it('returns top-level isOnline from the latest session even when latestEvent is missing', async () => {
    mocks.getLatestEventsByUserId.mockResolvedValue([]);
    mocks.findUserById.mockResolvedValue({ id: BigInt(123), displayName: 'Ada' });
    mocks.findLatestSessionByUserId.mockResolvedValue({ id: 'session-active', endedAt: '2026-07-21 11:59:00.000' });
    mocks.isSessionOnline.mockReturnValue(true);

    const result = await caller.single({ projectId: '42', userId: '123' });

    expect(result.isOnline).toBe(true);
    expect(result.latestEvent).toBeNull();
    expect(result.user).toMatchObject({ id: '123', displayName: 'Ada' });
  });

  it('marks each session in users.events with its own online state', async () => {
    mocks.getLatestEventsByUserId.mockResolvedValue([
      { id: 'evt-new', sessionId: 'session-stale', createdAt: '2026-07-21 11:52:00.000' },
      { id: 'evt-old', sessionId: 'session-heartbeat', createdAt: '2026-07-21 11:45:00.000' },
    ]);
    mocks.findSessionsByIds.mockResolvedValue([
      { id: 'session-stale', endedAt: '2026-07-21 11:52:00.000' },
      { id: 'session-heartbeat', endedAt: '2026-07-21 11:59:30.000' },
    ]);
    mocks.isSessionOnline.mockImplementation((session: { id: string }) => session.id === 'session-heartbeat');

    const result = await caller.events({ projectId: '42', userId: '123' });

    expect(result.sessions).toEqual([
      { id: 'session-stale', endedAt: '2026-07-21 11:52:00.000', isOnline: false },
      { id: 'session-heartbeat', endedAt: '2026-07-21 11:59:30.000', isOnline: true },
    ]);
  });
});
