import type * as clickhouse from 'clickhouse';
import { Hono } from 'hono';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicApi } from '../index';

const { findByKeyHashMock, findByIdMock, findByOrganizationIdMock, findByIdsMock, getRedisClientMock } = vi.hoisted(
  () => ({
    findByKeyHashMock: vi.fn(),
    findByIdMock: vi.fn(),
    findByOrganizationIdMock: vi.fn(),
    findByIdsMock: vi.fn(),
    getRedisClientMock: vi.fn(),
  }),
);

vi.mock('database', () => ({
  dbApiKey: {
    findByKeyHash: findByKeyHashMock,
  },
  dbProject: {
    findById: findByIdMock,
    findByOrganizationId: findByOrganizationIdMock,
    findByIds: findByIdsMock,
  },
}));

vi.mock('../../utils/redis', () => ({
  getRedisClient: getRedisClientMock,
}));

vi.mock('clickhouse', async (importOriginal) => ({
  ...(await importOriginal<typeof clickhouse>()),
  clickhouseEvent: {
    getFilterableData: vi.fn().mockResolvedValue({ eventNames: [], pages: {}, sources: { countryCodes: [] } }),
  },
}));

const AUTHORIZATION = 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456';

function project(id: string, name: string, organizationId = 'org_1') {
  return {
    id,
    name,
    domain: `${name.toLowerCase()}.example.com`,
    token: `token_${id}`,
    organizationId,
    createdAt: new Date('2026-02-07T12:00:00.000Z'),
    firstEventAt: null,
    publicDashboard: false,
    excludedIps: null,
    excludedCountries: null,
  };
}

const shop = project('100', 'Shop');
const blog = project('200', 'Blog');
const otherOrgProject = project('300', 'Other', 'org_2');

function projectKey() {
  return {
    id: 'key_project',
    organizationId: 'org_1',
    projectId: shop.id,
    allProjects: false,
    project: shop,
    projects: [],
  };
}

function organizationKey({ allProjects = false, projectIds = [] as string[] } = {}) {
  return {
    id: 'key_org',
    organizationId: 'org_1',
    projectId: null,
    allProjects,
    project: null,
    projects: projectIds.map((projectId) => ({ projectId })),
  };
}

async function request(path: string, projectHeader?: string) {
  return createPublicApi().request(path, {
    headers: {
      Authorization: AUTHORIZATION,
      ...(projectHeader !== undefined ? { 'X-Vemetric-Project': projectHeader } : {}),
    },
  });
}

describe('public API project selection', () => {
  const findByKeyHash = findByKeyHashMock as Mock;
  const findById = findByIdMock as Mock;
  const findByOrganizationId = findByOrganizationIdMock as Mock;
  const findByIds = findByIdsMock as Mock;
  const getRedisClient = getRedisClientMock as Mock;
  let evalMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    evalMock = vi.fn().mockResolvedValue([1, 60]);
    getRedisClient.mockResolvedValue({ eval: evalMock });
    findById.mockImplementation(
      async (id: string) => [shop, blog, otherOrgProject].find((candidate) => candidate.id === id) ?? null,
    );
  });

  describe('project keys', () => {
    beforeEach(() => {
      findByKeyHash.mockResolvedValue(projectKey());
    });

    it('use their project without the header', async () => {
      const response = await request('/v1/project');

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ project: { id: shop.id } });
      expect(findById).not.toHaveBeenCalled();
    });

    it('accept the header when it names their project', async () => {
      const response = await request('/v1/project', shop.id);

      expect(response.status).toBe(200);
    });

    it('return 404 when the header names another project', async () => {
      const response = await request('/v1/project', blog.id);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found or not covered by this API key' },
      });
    });

    it('list only their project', async () => {
      const response = await request('/v1/projects');

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        projects: [{ id: shop.id, name: 'Shop', domain: 'shop.example.com' }],
      });
    });
  });

  describe('organization keys', () => {
    it('return 400 without the header, even when they cover a single project', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ projectIds: [shop.id] }));

      const response = await request('/v1/funnels');

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'PROJECT_REQUIRED' } });
    });

    it('treat an empty header as missing', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));

      const response = await request('/v1/project', '  ');

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'PROJECT_REQUIRED' } });
    });

    it('access any project of their organization when they cover all projects', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));

      const response = await request('/v1/project', blog.id);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ project: { id: blog.id } });
    });

    it('access only their chosen projects', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ projectIds: [shop.id] }));

      expect((await request('/v1/project', shop.id)).status).toBe(200);
      const response = await request('/v1/project', blog.id);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'PROJECT_NOT_FOUND' } });
    });

    it('return 404 for projects of other organizations and unknown projects', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));

      expect((await request('/v1/project', otherOrgProject.id)).status).toBe(404);
      expect((await request('/v1/project', '999')).status).toBe(404);
    });

    it('list all projects of their organization by name when they cover all projects', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));
      findByOrganizationId.mockResolvedValue([shop, blog]);

      const response = await request('/v1/projects');

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        projects: [
          { id: blog.id, name: 'Blog', domain: 'blog.example.com' },
          { id: shop.id, name: 'Shop', domain: 'shop.example.com' },
        ],
      });
      expect(findByOrganizationId).toHaveBeenCalledWith({ organizationId: 'org_1' });
    });

    it('list their projects when the API is mounted under a path, as in the app', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));
      findByOrganizationId.mockResolvedValue([shop]);
      const app = new Hono().route('/api', createPublicApi());

      const response = await app.request('/api/v1/projects', { headers: { Authorization: AUTHORIZATION } });

      expect(response.status).toBe(200);
      const mountedProjectResponse = await app.request('/api/v1/project', {
        headers: { Authorization: AUTHORIZATION },
      });
      expect(mountedProjectResponse.status).toBe(400);
    });

    it('list their chosen projects without needing the header', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ projectIds: [blog.id] }));
      findByIds.mockResolvedValue([blog]);

      const response = await request('/v1/projects');

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        projects: [{ id: blog.id, name: 'Blog', domain: 'blog.example.com' }],
      });
      expect(findByIds).toHaveBeenCalledWith({ ids: [blog.id], organizationId: 'org_1' });
    });
  });

  describe('plan limits', () => {
    async function requestOneYearOfFilterValues() {
      return createPublicApi().request('/v1/filters/values', {
        method: 'POST',
        headers: { Authorization: AUTHORIZATION, 'Content-Type': 'application/json', 'X-Vemetric-Project': shop.id },
        body: JSON.stringify({ dateRange: '1year', fields: ['country'] }),
      });
    }

    it("come from the key's organization", async () => {
      findByKeyHash.mockResolvedValue({
        ...organizationKey({ allProjects: true }),
        organization: { id: 'org_1', customPlanEvents: null, billingInfo: { subscriptionStatus: 'active' } },
      });

      expect((await requestOneYearOfFilterValues()).status).toBe(200);
    });

    it('apply the free plan without an active subscription', async () => {
      findByKeyHash.mockResolvedValue({
        ...organizationKey({ allProjects: true }),
        organization: { id: 'org_1', customPlanEvents: null, billingInfo: null },
      });

      expect((await requestOneYearOfFilterValues()).status).toBe(403);
    });
  });

  describe('rate limit buckets', () => {
    it('count requests against the bucket of the requested project', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));

      await request('/v1/project', blog.id);

      expect(evalMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ keys: ['ratelimit:api:200'] }),
      );
    });

    it('count requests without a project against the bucket of the key', async () => {
      findByKeyHash.mockResolvedValue(organizationKey({ allProjects: true }));
      findByOrganizationId.mockResolvedValue([]);

      await request('/v1/projects');

      expect(evalMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ keys: ['ratelimit:api:key:key_org'] }),
      );
    });
  });
});
