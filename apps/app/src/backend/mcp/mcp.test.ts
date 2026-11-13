import { createHash } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { getMcpUrl } from '@vemetric/common/env';
import type * as clickhouse from 'clickhouse';
import { Hono } from 'hono';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMcpApp } from './index';

const {
  findByKeyHashMock,
  findByIdMock,
  findByOrganizationIdMock,
  findByIdsMock,
  getRedisClientMock,
  getFilterableDataMock,
  getEventPropertiesMock,
  queryUsersMock,
  findAccessTokenMock,
  findConnectionMock,
  getUserOrganizationsWithProjectsMock,
  findOrganizationByIdMock,
} = vi.hoisted(() => ({
  findByKeyHashMock: vi.fn(),
  findByIdMock: vi.fn(),
  findByOrganizationIdMock: vi.fn(),
  findByIdsMock: vi.fn(),
  getRedisClientMock: vi.fn(),
  getFilterableDataMock: vi.fn(),
  getEventPropertiesMock: vi.fn(),
  queryUsersMock: vi.fn(),
  findAccessTokenMock: vi.fn(),
  findConnectionMock: vi.fn(),
  getUserOrganizationsWithProjectsMock: vi.fn(),
  findOrganizationByIdMock: vi.fn(),
}));

vi.mock('database', () => ({
  dbApiKey: {
    findByKeyHash: findByKeyHashMock,
  },
  dbProject: {
    findById: findByIdMock,
    findByOrganizationId: findByOrganizationIdMock,
    findByIds: findByIdsMock,
  },
  dbOauth: {
    findAccessToken: findAccessTokenMock,
    findConnection: findConnectionMock,
  },
  dbOrganization: {
    getUserOrganizationsWithProjects: getUserOrganizationsWithProjectsMock,
    findById: findOrganizationByIdMock,
  },
}));

vi.mock('../utils/redis', () => ({
  getRedisClient: getRedisClientMock,
}));

vi.mock('clickhouse', async (importOriginal) => ({
  ...(await importOriginal<typeof clickhouse>()),
  clickhouseEvent: {
    getFilterableData: getFilterableDataMock,
    getEventProperties: getEventPropertiesMock,
    queryUsers: queryUsersMock,
  },
}));

const API_KEY = 'vem_abcdefghijklmnopqrstuvwxyz123456';
const MCP_URL = 'http://app.vemetric.localhost/mcp';

function project(id: string, name: string, organizationId = 'org_1') {
  return {
    id,
    name,
    domain: `${name.toLowerCase()}.example.com`,
    token: `token_${id}`,
    organizationId,
    createdAt: new Date('2026-02-07T12:00:00.000Z'),
    firstEventAt: new Date('2026-02-08T09:00:00.000Z'),
    publicDashboard: false,
    excludedIps: '1.2.3.4',
    excludedCountries: null,
  };
}

const shop = project('100', 'Shop');
const blog = project('200', 'Blog');

const organization = { id: 'org_1', customPlanEvents: null, billingInfo: null };

function projectKey() {
  return {
    id: 'key_project',
    keyPrefix: 'vem_abcd',
    organizationId: 'org_1',
    organization,
    projectId: shop.id,
    allProjects: false,
    project: shop,
    projects: [],
  };
}

function organizationKey({ allProjects = false, projectIds = [] as string[] } = {}) {
  return {
    id: 'key_org',
    keyPrefix: 'vem_abcd',
    organizationId: 'org_1',
    organization,
    projectId: null,
    allProjects,
    project: null,
    projects: projectIds.map((projectId) => ({ projectId })),
  };
}

const app = new Hono().route('/mcp', createMcpApp());
const protocolVersions: Array<string | null> = [];
const fetchFromApp = async (url: string | URL, init?: RequestInit) => {
  protocolVersions.push(new Headers(init?.headers).get('MCP-Protocol-Version'));
  return app.request(url.toString(), init);
};

const clients: Client[] = [];

async function connect({ modern = false, token = API_KEY } = {}) {
  const client = new Client(
    { name: 'vemetric-test', version: '1.0.0' },
    modern ? { versionNegotiation: { mode: 'auto' } } : undefined,
  );
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: fetchFromApp,
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  clients.push(client);
  return client;
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>) {
  const [content] = result.content as Array<{ type: string; text: string }>;
  return content.text;
}

describe('MCP server', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const findById = findByIdMock as Mock;
  const findByOrganizationId = findByOrganizationIdMock as Mock;
  const findByIds = findByIdsMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;
  const getFilterableData = getFilterableDataMock as Mock;
  let evalMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    protocolVersions.length = 0;
    evalMock = vi.fn().mockResolvedValue([1, 60]);
    getRedisClient.mockResolvedValue({ eval: evalMock });
    findByKeyHash.mockResolvedValue(projectKey());
    findById.mockImplementation(async (id: string) => [shop, blog].find((candidate) => candidate.id === id) ?? null);
    findByOrganizationId.mockResolvedValue([shop, blog]);
    findByIds.mockImplementation(async ({ ids }: { ids: string[] }) =>
      [shop, blog].filter((candidate) => ids.includes(candidate.id)),
    );
    getFilterableData.mockResolvedValue({
      eventNames: ['signup', 'purchase'],
      pages: { pathnames: ['/pricing', '/', '/blog'], origins: [], clientNames: [], deviceTypes: [], osNames: [] },
      sources: {
        referrers: [],
        referrerTypes: [],
        utmCampaigns: [],
        utmContents: [],
        utmMediums: [],
        utmSources: [],
        utmTerms: [],
        countryCodes: ['DE', 'US'],
        cities: [],
      },
    });
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  describe('authentication', () => {
    it('rejects requests without an API key with 401 and a WWW-Authenticate header', async () => {
      const response = await app.request('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('Bearer');
      expect(findByKeyHash).not.toHaveBeenCalled();
    });

    it('rejects unknown API keys', async () => {
      findByKeyHash.mockResolvedValue(null);

      await expect(connect()).rejects.toThrow();
    });
  });

  describe('tools', () => {
    it('lists the read-only tools', async () => {
      const client = await connect();

      const { tools } = await client.listTools();

      expect(tools.map((tool) => tool.name)).toEqual([
        'list_projects',
        'get_project',
        'query_analytics',
        'list_filter_values',
        'list_event_properties',
        'list_users',
        'get_user',
        'get_user_events',
        'list_funnels',
        'get_funnel_results',
      ]);
      for (const tool of tools) {
        expect(tool.annotations, tool.name).toMatchObject({ readOnlyHint: true, openWorldHint: false });
        expect(tool.description, tool.name).toBeTruthy();
      }
      const queryAnalytics = tools.find((tool) => tool.name === 'query_analytics');
      expect(queryAnalytics?.inputSchema.properties).toMatchObject({
        projectId: { type: 'string' },
        limit: { type: 'integer', default: 100 },
      });
      expect(queryAnalytics?.inputSchema.required).toEqual(['dateRange']);
    });

    it('serves clients of the 2026-07-28 protocol revision too', async () => {
      const client = await connect({ modern: true });

      const result = await client.callTool({ name: 'list_projects', arguments: {} });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        projects: [{ id: shop.id, name: 'Shop', domain: 'shop.example.com' }],
      });
      expect(protocolVersions.at(-1)).toBe('2026-07-28');
    });

    it("returns the project without its token, with the plan and today's date", async () => {
      const client = await connect();

      const result = await client.callTool({ name: 'get_project', arguments: {} });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        project: {
          id: shop.id,
          name: 'Shop',
          domain: 'shop.example.com',
          createdAt: '2026-02-07T12:00:00.000Z',
          firstEventAt: '2026-02-08T09:00:00.000Z',
        },
        plan: { name: 'Free', dataRetention: expect.stringContaining('Last 30 days') },
        today: new Date().toISOString().slice(0, 10),
      });
      expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
    });

    it('returns filter values with a hasMore flag and without the echoed query', async () => {
      const client = await connect();

      const result = await client.callTool({
        name: 'list_filter_values',
        arguments: { dateRange: '7days', fields: ['page:path'], limit: 2 },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        period: expect.any(Object),
        data: [
          {
            field: 'page:path',
            values: ['/', '/blog'],
            pagination: { limit: 2, offset: 0, returned: 2, hasMore: true },
          },
        ],
      });
    });

    it('returns the properties of several events at once', async () => {
      (getEventPropertiesMock as Mock).mockResolvedValue([
        { eventName: 'signup', name: 'plan', count: 40, users: 30 },
        { eventName: 'signup', name: 'source', count: 12, users: 10 },
      ]);
      const client = await connect();

      const result = await client.callTool({
        name: 'list_event_properties',
        arguments: { eventNames: ['signup', 'purchase'], dateRange: '30days', limit: 2 },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        period: expect.any(Object),
        data: [
          {
            eventName: 'signup',
            properties: [
              { name: 'plan', events: 40, users: 30 },
              { name: 'source', events: 12, users: 10 },
            ],
            pagination: { limit: 2, offset: 0, returned: 2, hasMore: true },
          },
          { eventName: 'purchase', properties: [], pagination: { limit: 2, offset: 0, returned: 0, hasMore: false } },
        ],
      });
    });

    it('returns invalid input as a tool error', async () => {
      const client = await connect();

      const result = await client.callTool({
        name: 'query_analytics',
        arguments: { dateRange: '7days', groupBy: ['country', 'city'] },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('groupBy can include max one item');
    });

    it('finds users by name or identifier', async () => {
      (queryUsersMock as Mock).mockResolvedValue([
        {
          id: BigInt(7),
          identifier: 'u-7',
          displayName: 'octocat',
          countryCode: 'DE',
          lastSeenAt: '2026-02-09 10:00:00',
        },
      ]);
      const client = await connect();

      const result = await client.callTool({
        name: 'list_users',
        arguments: { projectId: shop.id, dateRange: '30days', search: '  Octo ' },
      });

      expect(result.isError).toBeFalsy();
      expect(queryUsersMock).toHaveBeenCalledWith(expect.objectContaining({ projectId: BigInt(100), search: 'Octo' }));
      expect(result.structuredContent).toMatchObject({ users: [{ id: '7', displayName: 'octocat' }] });
    });

    it('validates filters of tools that only reference the filter format of query_analytics', async () => {
      const client = await connect();

      const result = await client.callTool({
        name: 'list_users',
        arguments: { dateRange: '7days', filters: [{ type: 'page', path: { operator: 'like', value: '/blog' } }] },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('filters.0.path.operator');
    });

    it('keeps the tool definitions compact', async () => {
      const client = await connect();

      const { tools } = await client.listTools();

      // Only query_analytics carries the full filter schema (~5 KB), see createCompactFilters. The other tools describe
      // the filter shapes in text (~1 KB more), because clients like Claude.ai load tool definitions on demand. Raised
      // from 27,500 for the firstVisit:* grouping tokens, which appear in both the groupBy and the orderBy enum.
      expect(JSON.stringify(tools).length).toBeLessThan(28_000);
      const listUsers = tools.find((tool) => tool.name === 'list_users');
      expect(listUsers?.inputSchema.properties?.filters).toMatchObject({
        items: { type: 'object', properties: { type: { type: 'string' } } },
      });
    });
  });

  describe('project access', () => {
    it('lists the projects of an organization key', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));
      const client = await connect();

      const result = await client.callTool({ name: 'list_projects', arguments: {} });

      expect(result.structuredContent).toEqual({
        projects: [
          { id: blog.id, name: 'Blog', domain: 'blog.example.com' },
          { id: shop.id, name: 'Shop', domain: 'shop.example.com' },
        ],
      });
    });

    it('asks for a projectId when the credentials cover several projects', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));
      const client = await connect();

      const result = await client.callTool({ name: 'list_funnels', arguments: {} });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('Call list_projects');
    });

    it('uses the only project of an organization key without a projectId', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ projectIds: [blog.id] }));
      const client = await connect();

      const result = await client.callTool({ name: 'get_project', arguments: {} });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ project: { id: blog.id } });
    });

    it('uses the requested project', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));
      const client = await connect();

      const result = await client.callTool({ name: 'get_project', arguments: { projectId: blog.id } });

      expect(result.structuredContent).toMatchObject({ project: { id: blog.id } });
    });

    it("doesn't reveal projects the credentials don't cover", async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ projectIds: [shop.id] }));
      const client = await connect();

      const result = await client.callTool({ name: 'get_project', arguments: { projectId: blog.id } });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('No project with this projectId is available');
      expect(textOf(result)).not.toContain('Blog');
    });
  });

  describe('plan limits', () => {
    it('explain the plan limit and link to the billing settings', async () => {
      const client = await connect();

      const result = await client.callTool({
        name: 'list_filter_values',
        arguments: { dateRange: '1year', fields: ['country'] },
      });

      expect(result.isError).toBe(true);
      const text = textOf(result);
      expect(text).toContain('Vemetric plan (Free) only includes data from the last 30 days');
      expect(text).toContain('/o/org_1?orgSettings=billing&pricingDialog=true');
      expect(getFilterableData).not.toHaveBeenCalled();
    });

    it('name the requested start date of a custom period', async () => {
      const client = await connect();

      const result = await client.callTool({
        name: 'list_filter_values',
        arguments: { dateRange: ['2025-01-01', '2025-01-31'], fields: ['country'] },
      });

      expect(textOf(result)).toContain('The requested period starts 2025-01-01');
    });
  });

  describe('rate limiting', () => {
    it("counts tool calls against the project's MCP bucket", async () => {
      const client = await connect();

      await client.callTool({ name: 'get_project', arguments: {} });

      expect(evalMock).toHaveBeenCalledTimes(1);
      expect(evalMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ keys: ['ratelimit:mcp:100'] }),
      );
    });

    it('counts failed project lookups against the bucket of the key', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ projectIds: [shop.id] }));
      const client = await connect();

      await client.callTool({ name: 'get_project', arguments: { projectId: blog.id } });

      expect(evalMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ keys: ['ratelimit:mcp:key:key_org'] }),
      );
    });

    it('returns a tool error that says how long to wait', async () => {
      evalMock.mockResolvedValue([101, 42]);
      const client = await connect();

      const result = await client.callTool({ name: 'get_project', arguments: {} });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('Try again in 42 seconds');
    });

    it("doesn't count requests that aren't tool calls", async () => {
      const client = await connect();

      await client.listTools();
      await client.listPrompts();

      expect(evalMock).not.toHaveBeenCalled();
    });
  });

  describe('OAuth', () => {
    const OAUTH_TOKEN = 'vmat_abcdefghijklmnopqrstuvwxyz0123456789';
    const news = project('300', 'News', 'org_2');
    const findAccessToken = findAccessTokenMock as Mock;
    const findConnection = findConnectionMock as Mock;
    const getUserOrganizationsWithProjects = getUserOrganizationsWithProjectsMock as Mock;
    const findOrganizationById = findOrganizationByIdMock as Mock;

    function accessToken(overrides: Record<string, unknown> = {}) {
      return {
        userId: 'user_1',
        clientId: 'client_1',
        revoked: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        resources: [getMcpUrl()],
        scopes: ['analytics:read', 'offline_access'],
        oauthclient: { clientId: 'client_1', name: 'Claude', disabled: false },
        session: null,
        ...overrides,
      };
    }

    function connection(overrides: Record<string, unknown> = {}) {
      return {
        id: 'conn_1',
        userId: 'user_1',
        clientId: 'client_1',
        allOrganizations: false,
        organizations: [] as Array<{ organizationId: string }>,
        projects: [] as Array<{ projectId: string }>,
        ...overrides,
      };
    }

    function postWithoutClient(authorization?: string) {
      return app.request('/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
    }

    beforeEach(() => {
      findAccessToken.mockResolvedValue(accessToken());
      findConnection.mockResolvedValue(
        connection({ projects: [{ projectId: blog.id }], organizations: [{ organizationId: 'org_2' }] }),
      );
      // The user can access Shop and Blog in org_1 and News in org_2.
      getUserOrganizationsWithProjects.mockResolvedValue([
        { organization: { id: 'org_1', project: [shop, blog] } },
        { organization: { id: 'org_2', project: [news] } },
      ]);
      findOrganizationById.mockImplementation(async (id: string) => ({
        id,
        customPlanEvents: null,
        billingInfo: null,
      }));
    });

    it('points requests without credentials to the OAuth discovery, without an error', async () => {
      const response = await postWithoutClient();

      expect(response.status).toBe(401);
      const challenge = response.headers.get('WWW-Authenticate');
      expect(challenge).toContain(
        `resource_metadata="${new URL(getMcpUrl()).origin}/.well-known/oauth-protected-resource/mcp"`,
      );
      expect(challenge).toContain('scope="analytics:read"');
      expect(challenge).not.toContain('error=');
    });

    it('rejects unknown access tokens with invalid_token', async () => {
      findAccessToken.mockResolvedValue(null);

      const response = await postWithoutClient(`Bearer ${OAUTH_TOKEN}`);

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
      expect(findByKeyHash).not.toHaveBeenCalled();
    });

    it('looks the token up by the hash the OAuth provider stores', async () => {
      await connect({ token: OAUTH_TOKEN });

      const hash = createHash('sha256').update(OAUTH_TOKEN.slice('vmat_'.length)).digest('base64url');
      expect(findAccessToken).toHaveBeenCalledWith(hash);
    });

    it('rejects tokens without the analytics scope with 403 insufficient_scope', async () => {
      findAccessToken.mockResolvedValue(accessToken({ scopes: ['offline_access'] }));

      const response = await postWithoutClient(`Bearer ${OAUTH_TOKEN}`);

      expect(response.status).toBe(403);
      expect(response.headers.get('WWW-Authenticate')).toContain('error="insufficient_scope"');
    });

    it('lists only the shared projects the user can access, with a hint where to share more', async () => {
      const client = await connect({ token: OAUTH_TOKEN });

      const result = await client.callTool({ name: 'list_projects', arguments: {} });

      expect(result.structuredContent).toEqual({
        projects: [
          { id: blog.id, name: 'Blog', domain: 'blog.example.com' },
          { id: news.id, name: 'News', domain: 'news.example.com' },
        ],
        sharing: expect.stringContaining('/?settings=apps'),
      });
    });

    it("doesn't share projects the user can no longer access", async () => {
      findConnection.mockResolvedValue(connection({ allOrganizations: true }));
      getUserOrganizationsWithProjects.mockResolvedValue([{ organization: { id: 'org_1', project: [shop] } }]);
      const client = await connect({ token: OAUTH_TOKEN });

      const result = await client.callTool({ name: 'list_projects', arguments: {} });

      expect(result.structuredContent).toMatchObject({ projects: [{ id: shop.id }] });
    });

    it('rejects projects that are not shared and links to the connected apps settings', async () => {
      const client = await connect({ token: OAUTH_TOKEN });

      const result = await client.callTool({ name: 'get_project', arguments: { projectId: shop.id } });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('No project with this projectId is shared with this app');
      expect(textOf(result)).toContain('/?settings=apps');
      expect(evalMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ keys: ['ratelimit:mcp:oauth:conn_1'] }),
      );
    });

    it("applies the plan of the project's organization", async () => {
      const client = await connect({ token: OAUTH_TOKEN });

      const result = await client.callTool({
        name: 'list_filter_values',
        arguments: { projectId: news.id, dateRange: '1year', fields: ['country'] },
      });

      expect(findOrganizationById).toHaveBeenCalledWith('org_2');
      expect(textOf(result)).toContain('/o/org_2?orgSettings=billing&pricingDialog=true');
    });

    it('rejects tokens of a connection the user removed', async () => {
      findConnection.mockResolvedValue(null);

      const response = await postWithoutClient(`Bearer ${OAUTH_TOKEN}`);

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
    });
  });

  describe('prompts', () => {
    it('lists the prompts and fills in their arguments', async () => {
      const client = await connect();

      const { prompts } = await client.listPrompts();
      const result = await client.getPrompt({ name: 'period_report', arguments: { period: 'week' } });

      expect(prompts.map((prompt) => prompt.name)).toEqual([
        'period_report',
        'investigate_change',
        'funnel_analysis',
        'conversion_sources',
        'user_journey',
      ]);
      const [message] = result.messages;
      expect(message.role).toBe('user');
      expect(message.content).toMatchObject({ type: 'text', text: expect.stringContaining('for the last week') });
    });
  });
});
