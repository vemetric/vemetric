import type { ApiKey, Prisma } from '@prisma/client';
import { type DbClient, prismaClient } from '../client';

export type { ApiKey };

const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

const listSelect = {
  id: true,
  name: true,
  keyPrefix: true,
  createdAt: true,
  revokedAt: true,
  createdBy: { select: userSelect },
  revokedBy: { select: userSelect },
} as const;

const authenticatedApiKeyInclude = {
  organization: { include: { billingInfo: true } },
  project: true,
  projects: { select: { projectId: true } },
} as const;

/** An active key with everything needed to resolve which projects it covers. */
export type AuthenticatedApiKey = Prisma.ApiKeyGetPayload<{ include: typeof authenticatedApiKeyInclude }>;

export const dbApiKey = {
  /**
   * Creates a project key (`projectId` set) or an organization key covering all projects (`allProjects`)
   * or the chosen ones (`projectIds`).
   */
  create: ({
    id,
    organizationId,
    projectId,
    allProjects = false,
    projectIds = [],
    name,
    keyHash,
    keyPrefix,
    createdByUserId,
    client = prismaClient,
  }: {
    id: string;
    organizationId: string;
    projectId?: string;
    allProjects?: boolean;
    projectIds?: string[];
    name: string;
    keyHash: string;
    keyPrefix: string;
    createdByUserId: string;
    client?: DbClient;
  }) =>
    client.apiKey.create({
      data: {
        id,
        organizationId,
        projectId,
        allProjects,
        name,
        keyHash,
        keyPrefix,
        createdByUserId,
        projects: projectIds.length > 0 ? { create: projectIds.map((projectId) => ({ projectId })) } : undefined,
      },
    }),

  findByKeyHash: ({ keyHash, client = prismaClient }: { keyHash: string; client?: DbClient }) =>
    client.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      include: authenticatedApiKeyInclude,
    }),

  /** The project keys of a project. */
  listByProjectId: ({ projectId, client = prismaClient }: { projectId: string; client?: DbClient }) =>
    client.apiKey.findMany({
      where: { projectId },
      select: listSelect,
      orderBy: { createdAt: 'desc' },
    }),

  /** The organization keys of an organization, with the projects they cover. */
  listByOrganizationId: ({ organizationId, client = prismaClient }: { organizationId: string; client?: DbClient }) =>
    client.apiKey.findMany({
      where: { organizationId, projectId: null },
      select: {
        ...listSelect,
        allProjects: true,
        projects: {
          select: { project: { select: { id: true, name: true, domain: true } } },
          orderBy: { project: { name: 'asc' } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

  /** The active organization keys that cover a project. */
  listActiveOrganizationKeysForProject: ({
    organizationId,
    projectId,
    client = prismaClient,
  }: {
    organizationId: string;
    projectId: string;
    client?: DbClient;
  }) =>
    client.apiKey.findMany({
      where: {
        organizationId,
        projectId: null,
        revokedAt: null,
        OR: [{ allProjects: true }, { projects: { some: { projectId } } }],
      },
      select: { id: true, name: true, keyPrefix: true, allProjects: true },
      orderBy: { createdAt: 'desc' },
    }),

  /** Revokes a project key (`projectId`) or an organization key (`organizationId`). */
  revoke: ({
    id,
    revokedByUserId,
    client = prismaClient,
    ...owner
  }: ({ projectId: string } | { organizationId: string }) & {
    id: string;
    revokedByUserId: string;
    client?: DbClient;
  }) =>
    client.apiKey.updateMany({
      where: {
        id,
        revokedAt: null,
        ...('projectId' in owner
          ? { projectId: owner.projectId }
          : { organizationId: owner.organizationId, projectId: null }),
      },
      data: { revokedAt: new Date(), revokedByUserId },
    }),
};
