import type { Prisma } from '@prisma/client';
import { customId21 } from '@vemetric/common/id';
import { prismaClient } from '../client';

const connectionInclude = {
  organizations: { select: { organizationId: true } },
  projects: { select: { projectId: true } },
} as const;

/** A user's connection to an OAuth client with the organizations and projects the client may access. */
export type OauthConnectionWithAccess = Prisma.OauthConnectionGetPayload<{ include: typeof connectionInclude }>;

/**
 * What a user shares with an OAuth client: all current and future organizations, or organizations with all their
 * current and future projects (`organizationIds`) and individual projects (`projectIds`).
 */
export type OauthConnectionAccess = {
  allOrganizations: boolean;
  organizationIds: string[];
  projectIds: string[];
};

const accessTokenInclude = {
  oauthclient: { select: { clientId: true, name: true, disabled: true } },
  session: { select: { expiresAt: true } },
} as const;

/** An access token with what's needed to check it: its client and the session it was issued in. */
export type OauthAccessTokenWithClient = Prisma.OauthAccessTokenGetPayload<{ include: typeof accessTokenInclude }>;

export const dbOauth = {
  /** An access token by its stored hash (the OAuth provider never stores tokens in plain text). */
  findAccessToken: (tokenHash: string): Promise<OauthAccessTokenWithClient | null> =>
    prismaClient.oauthAccessToken.findUnique({ where: { token: tokenHash }, include: accessTokenInclude }),

  findClient: (clientId: string) => prismaClient.oauthClient.findUnique({ where: { clientId } }),

  findConnection: (userId: string, clientId: string): Promise<OauthConnectionWithAccess | null> =>
    prismaClient.oauthConnection.findUnique({
      where: { userId_clientId: { userId, clientId } },
      include: connectionInclude,
    }),

  /** Saves which organizations and projects the client may access, replacing an earlier choice. */
  saveConnection: ({ userId, clientId, access }: { userId: string; clientId: string; access: OauthConnectionAccess }) =>
    prismaClient.$transaction(async (tx) => {
      const connection = await tx.oauthConnection.upsert({
        where: { userId_clientId: { userId, clientId } },
        create: { id: customId21(), userId, clientId, allOrganizations: access.allOrganizations },
        update: { allOrganizations: access.allOrganizations },
      });

      await tx.oauthConnectionOrganization.deleteMany({ where: { connectionId: connection.id } });
      await tx.oauthConnectionProject.deleteMany({ where: { connectionId: connection.id } });

      if (!access.allOrganizations) {
        await tx.oauthConnectionOrganization.createMany({
          data: access.organizationIds.map((organizationId) => ({ connectionId: connection.id, organizationId })),
        });
        await tx.oauthConnectionProject.createMany({
          data: access.projectIds.map((projectId) => ({ connectionId: connection.id, projectId })),
        });
      }

      return connection;
    }),

  /**
   * Removes a client's access entirely: the connection, the consent and all tokens, so it has to ask again. Deleting
   * the consent alone wouldn't revoke the tokens already issued.
   */
  deleteConnection: (userId: string, clientId: string) =>
    prismaClient.$transaction([
      prismaClient.oauthAccessToken.deleteMany({ where: { userId, clientId } }),
      prismaClient.oauthRefreshToken.deleteMany({ where: { userId, clientId } }),
      prismaClient.oauthConsent.deleteMany({ where: { userId, clientId } }),
      prismaClient.oauthConnection.deleteMany({ where: { userId, clientId } }),
    ]),
};
