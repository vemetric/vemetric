import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oauthRouter } from './oauth';

const {
  verifyOAuthQueryParamsMock,
  findClientMock,
  findConnectionMock,
  saveConnectionMock,
  deleteConnectionMock,
  listConnectionsMock,
  getUserOrganizationsWithProjectsMock,
} = vi.hoisted(() => ({
  verifyOAuthQueryParamsMock: vi.fn(),
  findClientMock: vi.fn(),
  findConnectionMock: vi.fn(),
  saveConnectionMock: vi.fn(),
  deleteConnectionMock: vi.fn(),
  listConnectionsMock: vi.fn(),
  getUserOrganizationsWithProjectsMock: vi.fn(),
}));

vi.mock('@better-auth/oauth-provider', () => ({ verifyOAuthQueryParams: verifyOAuthQueryParamsMock }));
vi.mock('../utils/auth', () => ({ auth: { $context: Promise.resolve({ secret: 'test-secret' }) } }));
vi.mock('database', () => ({
  dbOauth: {
    findClient: findClientMock,
    findConnection: findConnectionMock,
    saveConnection: saveConnectionMock,
    deleteConnection: deleteConnectionMock,
    listConnections: listConnectionsMock,
  },
  dbOrganization: { getUserOrganizationsWithProjects: getUserOrganizationsWithProjectsMock },
  dbProject: {},
  OrganizationRole: { ADMIN: 'ADMIN', MEMBER: 'MEMBER' },
}));

const OAUTH_QUERY = new URLSearchParams({
  client_id: 'client_1',
  redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
  sig: 'signature',
}).toString();

const client = {
  clientId: 'client_1',
  name: 'Claude',
  uri: 'https://claude.ai',
  icon: 'https://example.com/logo.png',
  clientDiscoveryId: null,
  disabled: false,
};

const caller = oauthRouter.createCaller({
  var: { user: { id: 'user_1' }, session: { id: 'session_1' } },
} as never);

describe('oauth router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifyOAuthQueryParamsMock as Mock).mockResolvedValue(true);
    (findClientMock as Mock).mockResolvedValue(client);
    (findConnectionMock as Mock).mockResolvedValue(null);
    (getUserOrganizationsWithProjectsMock as Mock).mockResolvedValue([
      {
        organization: {
          id: 'org_b',
          name: 'Beta',
          project: [
            { id: 'p_2', name: 'Shop', domain: 'shop.example.com' },
            { id: 'p_1', name: 'Blog', domain: 'blog.example.com' },
          ],
        },
      },
      { organization: { id: 'org_a', name: 'Alpha', project: [] } },
    ]);
  });

  describe('consentInfo', () => {
    it('rejects authorization requests whose signature is invalid or expired', async () => {
      (verifyOAuthQueryParamsMock as Mock).mockResolvedValue(false);

      await expect(caller.consentInfo({ oauthQuery: OAUTH_QUERY })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(verifyOAuthQueryParamsMock).toHaveBeenCalledWith(OAUTH_QUERY, 'test-secret');
    });

    it('rejects unknown and disabled clients', async () => {
      (findClientMock as Mock).mockResolvedValue({ ...client, disabled: true });

      await expect(caller.consentInfo({ oauthQuery: OAUTH_QUERY })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('shows the app with where users return to, and what the user can share', async () => {
      const info = await caller.consentInfo({ oauthQuery: OAUTH_QUERY });

      expect(info.client).toEqual({
        clientId: 'client_1',
        name: 'Claude',
        // Dynamically registered apps choose their website and logo themselves, so they aren't shown.
        uri: null,
        icon: null,
        metadataHost: null,
        redirectTo: 'claude.ai',
      });
      expect(info.organizations.map(({ name }) => name)).toEqual(['Alpha', 'Beta']);
      expect(info.organizations[1].projects.map(({ name }) => name)).toEqual(['Blog', 'Shop']);
      expect(info.currentAccess).toBeNull();
    });

    it('names the domain of a client metadata document and shows its website and logo', async () => {
      (findClientMock as Mock).mockResolvedValue({
        ...client,
        clientId: 'https://cursor.com/oauth/client.json',
        clientDiscoveryId: 'cimd',
      });

      const info = await caller.consentInfo({ oauthQuery: OAUTH_QUERY });

      expect(info.client.metadataHost).toBe('cursor.com');
      expect(info.client.uri).toBe('https://claude.ai');
      expect(info.client.icon).toBe('https://example.com/logo.png');
    });

    it('shows logos of client metadata documents only over https', async () => {
      (findClientMock as Mock).mockResolvedValue({
        ...client,
        icon: 'http://insecure.example.com/logo.png',
        clientId: 'https://cursor.com/oauth/client.json',
        clientDiscoveryId: 'cimd',
      });

      const info = await caller.consentInfo({ oauthQuery: OAUTH_QUERY });

      expect(info.client.icon).toBeNull();
    });
  });

  describe('saveAccess', () => {
    it('saves the chosen organizations and projects without duplicates', async () => {
      await caller.saveAccess({
        oauthQuery: OAUTH_QUERY,
        access: { allOrganizations: false, organizationIds: ['org_a', 'org_a'], projectIds: ['p_1'] },
      });

      expect(saveConnectionMock).toHaveBeenCalledWith({
        userId: 'user_1',
        clientId: 'client_1',
        access: { allOrganizations: false, organizationIds: ['org_a'], projectIds: ['p_1'] },
      });
    });

    it('requires at least one organization or project', async () => {
      await expect(
        caller.saveAccess({
          oauthQuery: OAUTH_QUERY,
          access: { allOrganizations: false, organizationIds: [], projectIds: [] },
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(saveConnectionMock).not.toHaveBeenCalled();
    });

    it.each([
      ['organizations', { organizationIds: ['org_other'], projectIds: [] }],
      ['projects', { organizationIds: [], projectIds: ['p_other'] }],
    ])("rejects %s the user can't access", async (_, access) => {
      await expect(
        caller.saveAccess({ oauthQuery: OAUTH_QUERY, access: { allOrganizations: false, ...access } }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(saveConnectionMock).not.toHaveBeenCalled();
    });

    it('needs a valid authorization request', async () => {
      (verifyOAuthQueryParamsMock as Mock).mockResolvedValue(false);

      await expect(
        caller.saveAccess({
          oauthQuery: OAUTH_QUERY,
          access: { allOrganizations: true, organizationIds: [], projectIds: [] },
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  describe('connected apps', () => {
    it('changes the access of a connected app', async () => {
      (findConnectionMock as Mock).mockResolvedValue({ id: 'conn_1' });

      await caller.updateAccess({
        clientId: 'client_1',
        access: { allOrganizations: true, organizationIds: [], projectIds: [] },
      });

      expect(findConnectionMock).toHaveBeenCalledWith('user_1', 'client_1');
      expect(saveConnectionMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user_1', clientId: 'client_1' }),
      );
    });

    it("doesn't change the access of apps the user didn't connect", async () => {
      await expect(
        caller.updateAccess({
          clientId: 'client_1',
          access: { allOrganizations: true, organizationIds: [], projectIds: [] },
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(saveConnectionMock).not.toHaveBeenCalled();
    });

    it("disconnects only the user's own connection", async () => {
      await caller.disconnect({ clientId: 'client_1' });

      expect(deleteConnectionMock).toHaveBeenCalledWith('user_1', 'client_1');
    });
  });
});
