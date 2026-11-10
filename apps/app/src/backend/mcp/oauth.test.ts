import { getMcpUrl } from '@vemetric/common/env';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateOauthToken, connectionCoversProject, McpAuthError } from './oauth';

const { findAccessTokenMock, findConnectionMock } = vi.hoisted(() => ({
  findAccessTokenMock: vi.fn(),
  findConnectionMock: vi.fn(),
}));

vi.mock('database', () => ({
  dbOauth: {
    findAccessToken: findAccessTokenMock,
    findConnection: findConnectionMock,
  },
  dbOrganization: {},
}));

const TOKEN = 'vmat_abcdefghijklmnopqrstuvwxyz0123456789';
const HOUR = 60 * 60 * 1000;

function accessToken(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user_1',
    clientId: 'client_1',
    revoked: null,
    expiresAt: new Date(Date.now() + HOUR),
    resources: [getMcpUrl()],
    scopes: ['analytics:read'],
    oauthclient: { clientId: 'client_1', name: 'Claude', disabled: false },
    session: { expiresAt: new Date(Date.now() + HOUR) },
    ...overrides,
  };
}

const connection = {
  id: 'conn_1',
  userId: 'user_1',
  clientId: 'client_1',
  allOrganizations: false,
  organizations: [{ organizationId: 'org_2' }],
  projects: [{ projectId: 'p_1' }],
};

async function rejection(token = TOKEN) {
  const error = await authenticateOauthToken(token).catch((err: unknown) => err);
  expect(error).toBeInstanceOf(McpAuthError);
  return error as McpAuthError;
}

describe('authenticateOauthToken', () => {
  const findAccessToken = findAccessTokenMock as Mock;
  const findConnection = findConnectionMock as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    findAccessToken.mockResolvedValue(accessToken());
    findConnection.mockResolvedValue(connection);
  });

  it('returns the user, the client and the connection of a valid token', async () => {
    await expect(authenticateOauthToken(TOKEN)).resolves.toEqual({
      userId: 'user_1',
      clientId: 'client_1',
      clientName: 'Claude',
      connection,
    });
    expect(findConnection).toHaveBeenCalledWith('user_1', 'client_1');
  });

  it('rejects tokens without the OAuth prefix without a lookup', async () => {
    expect((await rejection('abc')).error).toBe('invalid_token');
    expect(findAccessToken).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown', null],
    ['expired', accessToken({ expiresAt: new Date(Date.now() - 1000) })],
    ['revoked', accessToken({ revoked: new Date() })],
    ['issued to a disabled client', accessToken({ oauthclient: { clientId: 'client_1', name: 'x', disabled: true } })],
    ['issued in an expired session', accessToken({ session: { expiresAt: new Date(Date.now() - 1000) } })],
    ['issued for another resource', accessToken({ resources: ['https://other.example.com/mcp'] })],
    ['issued without a user', accessToken({ userId: null })],
  ])('rejects %s tokens with invalid_token', async (_, token) => {
    findAccessToken.mockResolvedValue(token);

    expect((await rejection()).error).toBe('invalid_token');
  });

  it('accepts tokens without a resource and tokens of sessions that ended with offline access', async () => {
    findAccessToken.mockResolvedValue(accessToken({ resources: [], session: null }));

    await expect(authenticateOauthToken(TOKEN)).resolves.toMatchObject({ userId: 'user_1' });
  });

  it('rejects tokens without the analytics scope with insufficient_scope', async () => {
    findAccessToken.mockResolvedValue(accessToken({ scopes: ['offline_access'] }));

    expect((await rejection()).error).toBe('insufficient_scope');
  });

  it('rejects tokens whose connection was removed', async () => {
    findConnection.mockResolvedValue(null);

    expect((await rejection()).error).toBe('invalid_token');
  });
});

describe('connectionCoversProject', () => {
  const project = (id: string, organizationId: string) => ({ id, organizationId }) as never;

  it('covers chosen projects and all projects of chosen organizations', () => {
    expect(connectionCoversProject(connection as never, project('p_1', 'org_1'))).toBe(true);
    expect(connectionCoversProject(connection as never, project('p_9', 'org_2'))).toBe(true);
    expect(connectionCoversProject(connection as never, project('p_2', 'org_1'))).toBe(false);
  });

  it('covers every project when all organizations are shared', () => {
    expect(connectionCoversProject({ ...connection, allOrganizations: true } as never, project('p_2', 'org_3'))).toBe(
      true,
    );
  });
});
