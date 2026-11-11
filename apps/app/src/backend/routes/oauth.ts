import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { TRPCError } from '@trpc/server';
import { dbOauth, dbOrganization, type OauthConnectionAccess, type OauthConnectionWithAccess } from 'database';
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

type Memberships = Awaited<ReturnType<typeof dbOrganization.getUserOrganizationsWithProjects>>;

/** The organizations and projects a user can share, for the consent page and the connected apps settings. */
function toShareableOrganizations(memberships: Memberships) {
  return memberships
    .map(({ organization }) => ({
      id: organization.id,
      name: organization.name,
      projects: organization.project
        .map((project) => ({ id: project.id, name: project.name, domain: project.domain }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function toAccess(connection: OauthConnectionWithAccess): OauthConnectionAccess {
  return {
    allOrganizations: connection.allOrganizations,
    organizationIds: connection.organizations.map(({ organizationId }) => organizationId),
    projectIds: connection.projects.map(({ projectId }) => projectId),
  };
}

/** Saves what the user shares with the app. Only organizations and projects the user can access themselves. */
async function saveAccess(userId: string, clientId: string, input: z.infer<typeof accessSchema>) {
  const { allOrganizations } = input;
  const organizationIds = Array.from(new Set(input.organizationIds));
  const projectIds = Array.from(new Set(input.projectIds));

  if (!allOrganizations && organizationIds.length === 0 && projectIds.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Please choose at least one organization or project.' });
  }

  const memberships = await dbOrganization.getUserOrganizationsWithProjects(userId);
  const ownOrganizationIds = new Set(memberships.map(({ organization }) => organization.id));
  const ownProjectIds = new Set(memberships.flatMap(({ organization }) => organization.project.map(({ id }) => id)));
  if (!organizationIds.every((id) => ownOrganizationIds.has(id)) || !projectIds.every((id) => ownProjectIds.has(id))) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only share organizations and projects you can access.',
    });
  }

  await dbOauth.saveConnection({ userId, clientId, access: { allOrganizations, organizationIds, projectIds } });
}

/**
 * How the settings and the consent page show an app. Clients register themselves, so name, logo and website are
 * theirs: any app could use e.g. Vemetric's logo or website to look official. Logo and website are only shown for
 * Client ID Metadata Documents, where the metadata is hosted on the app's own domain (shown as `metadataHost`) and the
 * CIMD plugin checks that the website is on that domain; dynamically registered apps get a neutral icon.
 */
function toClientInfo(client: {
  clientId: string;
  name: string | null;
  uri: string | null;
  icon: string | null;
  clientDiscoveryId: string | null;
}) {
  const isMetadataDocument = client.clientDiscoveryId === 'cimd';
  return {
    clientId: client.clientId,
    name: client.name || 'Unknown app',
    uri: isMetadataDocument ? httpsUrlOrNull(client.uri) : null,
    icon: isMetadataDocument ? httpsUrlOrNull(client.icon) : null,
    // For Client ID Metadata Documents, the domain that hosts the metadata vouches for the app.
    metadataHost: isMetadataDocument ? describeUrl(client.clientId) : null,
  };
}

const clientIdSchema = z.object({ clientId: z.string().min(1).max(2000) });

export const oauthRouter = router({
  /** What the consent page shows: the app asking for access, and the organizations and projects the user can share. */
  consentInfo: loggedInProcedure.input(z.object({ oauthQuery: oauthQuerySchema })).query(async ({ ctx, input }) => {
    const { client, redirectUri } = await resolveAuthorizationRequest(input.oauthQuery);
    const [memberships, connection] = await Promise.all([
      dbOrganization.getUserOrganizationsWithProjects(ctx.user.id),
      dbOauth.findConnection(ctx.user.id, client.clientId),
    ]);

    return {
      // The name alone can't be trusted, so the page also shows where users return to.
      client: { ...toClientInfo(client), redirectTo: describeUrl(redirectUri) },
      organizations: toShareableOrganizations(memberships),
      currentAccess: connection ? toAccess(connection) : null,
    };
  }),

  /** Saves what the user shares with the app, right before the consent is accepted. */
  saveAccess: loggedInProcedure
    .input(z.object({ oauthQuery: oauthQuerySchema, access: accessSchema }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await resolveAuthorizationRequest(input.oauthQuery);
      await saveAccess(ctx.user.id, client.clientId, input.access);
    }),

  /** The connected apps in the account settings, with what each one can access. */
  listConnections: loggedInProcedure.query(async ({ ctx }) => {
    const [connections, memberships] = await Promise.all([
      dbOauth.listConnections(ctx.user.id),
      dbOrganization.getUserOrganizationsWithProjects(ctx.user.id),
    ]);

    return {
      connections: connections.map((connection) => ({
        client: toClientInfo(connection.client),
        connectedAt: connection.createdAt,
        lastUsedAt: connection.lastUsedAt,
        access: toAccess(connection),
      })),
      organizations: toShareableOrganizations(memberships),
    };
  }),

  /** Changes what a connected app can access. It applies to its next request. */
  updateAccess: loggedInProcedure
    .input(clientIdSchema.extend({ access: accessSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!(await dbOauth.findConnection(ctx.user.id, input.clientId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'This app is not connected.' });
      }
      await saveAccess(ctx.user.id, input.clientId, input.access);
    }),

  /** Disconnects an app: its tokens stop working right away, and it has to ask for access again. */
  disconnect: loggedInProcedure.input(clientIdSchema).mutation(async ({ ctx, input }) => {
    await dbOauth.deleteConnection(ctx.user.id, input.clientId);
  }),
});
