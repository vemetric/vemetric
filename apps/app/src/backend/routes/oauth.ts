import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { TRPCError } from '@trpc/server';
import { dbOauth, dbOrganization } from 'database';
import { z } from 'zod';
import { auth } from '../utils/auth';
import { loggedInProcedure, router } from '../utils/trpc';

/** The signed authorize parameters the OAuth provider passes to the consent page (`sig`, `exp`, `ba_*` included). */
const oauthQuerySchema = z.string().min(1).max(8000);

/**
 * The authorization request the consent page is about. The provider signed its parameters, so `client_id` and
 * `redirect_uri` are the ones the client sent to the authorize endpoint, not something the page made up.
 */
async function resolveAuthorizationRequest(oauthQuery: string) {
  const { secret } = await auth.$context;
  if (!(await verifyOAuthQueryParams(oauthQuery, secret))) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This authorization request has expired. Please connect again from your app.',
    });
  }

  const params = new URLSearchParams(oauthQuery);
  const clientId = params.get('client_id');
  const client = clientId ? await dbOauth.findClient(clientId) : null;
  if (!client || client.disabled) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown app. Please connect again from your app.' });
  }

  return { client, redirectUri: params.get('redirect_uri') };
}

function httpsUrlOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** The host of a web URL, or the scheme for native app redirects (e.g. `cursor:`). */
function describeUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.host : url.protocol;
  } catch {
    return null;
  }
}

const accessSchema = z.object({
  allOrganizations: z.boolean(),
  organizationIds: z.array(z.string()).max(1000),
  projectIds: z.array(z.string()).max(1000),
});

export const oauthRouter = router({
  /** What the consent page shows: the app asking for access, and the organizations and projects the user can share. */
  consentInfo: loggedInProcedure.input(z.object({ oauthQuery: oauthQuerySchema })).query(async ({ ctx, input }) => {
    const { client, redirectUri } = await resolveAuthorizationRequest(input.oauthQuery);
    const [memberships, connection] = await Promise.all([
      dbOrganization.getUserOrganizationsWithProjects(ctx.user.id),
      dbOauth.findConnection(ctx.user.id, client.clientId),
    ]);

    return {
      client: {
        // Clients register themselves, so the name alone can't be trusted: the page also shows where users return to,
        // and for Client ID Metadata Documents the domain that hosts the metadata.
        name: client.name || 'Unknown app',
        uri: httpsUrlOrNull(client.uri),
        icon: httpsUrlOrNull(client.icon),
        metadataHost: client.clientDiscoveryId === 'cimd' ? describeUrl(client.clientId) : null,
        redirectTo: describeUrl(redirectUri),
      },
      organizations: memberships
        .map(({ organization }) => ({
          id: organization.id,
          name: organization.name,
          projects: organization.project
            .map((project) => ({ id: project.id, name: project.name, domain: project.domain }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      currentAccess: connection
        ? {
            allOrganizations: connection.allOrganizations,
            organizationIds: connection.organizations.map(({ organizationId }) => organizationId),
            projectIds: connection.projects.map(({ projectId }) => projectId),
          }
        : null,
    };
  }),

  /**
   * Saves what the user shares with the app, right before the consent is accepted. Only organizations and projects
   * the user can access themselves are allowed.
   */
  saveAccess: loggedInProcedure
    .input(z.object({ oauthQuery: oauthQuerySchema, access: accessSchema }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await resolveAuthorizationRequest(input.oauthQuery);
      const { allOrganizations } = input.access;
      const organizationIds = [...new Set(input.access.organizationIds)];
      const projectIds = [...new Set(input.access.projectIds)];

      if (!allOrganizations && organizationIds.length === 0 && projectIds.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Please choose at least one organization or project.' });
      }

      const memberships = await dbOrganization.getUserOrganizationsWithProjects(ctx.user.id);
      const ownOrganizationIds = new Set(memberships.map(({ organization }) => organization.id));
      const ownProjectIds = new Set(
        memberships.flatMap(({ organization }) => organization.project.map(({ id }) => id)),
      );
      if (
        !organizationIds.every((id) => ownOrganizationIds.has(id)) ||
        !projectIds.every((id) => ownProjectIds.has(id))
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only share organizations and projects you can access.',
        });
      }

      await dbOauth.saveConnection({
        userId: ctx.user.id,
        clientId: client.clientId,
        access: { allOrganizations, organizationIds, projectIds },
      });
    }),
});
