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
vi.mock('clickhouse', () => ({}));
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
