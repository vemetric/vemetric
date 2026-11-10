import { createHash } from 'node:crypto';
import { getMcpUrl } from '@vemetric/common/env';
import { dbOauth, dbOrganization, type OauthConnectionWithAccess, type Project } from 'database';
import { MCP_SCOPE, OAUTH_ACCESS_TOKEN_PREFIX } from '../utils/oauth-consts';

/** A user who connected an OAuth client (e.g. Claude) and chose which organizations and projects it may access. */
export type OauthAuthentication = {
  userId: string;
  clientId: string;
  clientName: string | null;
  connection: OauthConnectionWithAccess;
};

/** A rejected MCP credential, answered with an RFC 6750 `WWW-Authenticate` challenge. */
export class McpAuthError extends Error {
  constructor(
    readonly error: 'invalid_token' | 'insufficient_scope',
    message: string,
  ) {
    super(message);
  }
}

function invalidToken(message: string) {
  return new McpAuthError('invalid_token', message);
}

/** The OAuth provider stores opaque tokens as their unpadded base64url SHA-256 hash (`storeTokens: "hashed"`). */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function isOauthAccessToken(token: string): boolean {
  return token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX);
}

/**
 * Checks an OAuth access token: unexpired, not revoked, the client not disabled, issued for the MCP server with the
 * MCP scope, and without `offline_access` its browser session still active. The connection must still exist, so
 * disconnecting an app in the settings revokes its access right away.
 */
export async function authenticateOauthToken(token: string): Promise<OauthAuthentication> {
  if (!isOauthAccessToken(token)) {
    throw invalidToken('Invalid access token');
  }

  const accessToken = await dbOauth.findAccessToken(hashToken(token.slice(OAUTH_ACCESS_TOKEN_PREFIX.length)));
  const now = new Date();
  // `offline_access` grants outlive the browser session (it expires after a week without using the dashboard), but the
  // refresh grant copies the session id onto every new access token. Unlike the provider's introspection, only tokens
  // without `offline_access` depend on the session. Signing out deletes the session and revokes those tokens anyway.
  const sessionEnded =
    !!accessToken?.session && accessToken.session.expiresAt < now && !accessToken.scopes.includes('offline_access');
  if (
    !accessToken?.userId ||
    accessToken.revoked ||
    accessToken.expiresAt < now ||
    accessToken.oauthclient.disabled ||
    sessionEnded
  ) {
    throw invalidToken('Invalid, expired or revoked access token');
  }

  // Tokens of clients that didn't name a resource aren't bound to one; a token for another resource is rejected.
  if (accessToken.resources.length > 0 && !accessToken.resources.includes(getMcpUrl())) {
    throw invalidToken('The access token was not issued for this MCP server');
  }
  if (!accessToken.scopes.includes(MCP_SCOPE)) {
    throw new McpAuthError('insufficient_scope', `The access token lacks the ${MCP_SCOPE} scope`);
  }

  const connection = await dbOauth.findConnection(accessToken.userId, accessToken.clientId);
  if (!connection) {
    throw invalidToken('The access to Vemetric was removed, please connect again');
  }

  return {
    userId: accessToken.userId,
    clientId: accessToken.clientId,
    clientName: accessToken.oauthclient.name,
    connection,
  };
}

/** Whether the connection covers a project the user can access. */
export function connectionCoversProject(connection: OauthConnectionWithAccess, project: Project): boolean {
  return (
    connection.allOrganizations ||
    connection.organizations.some(({ organizationId }) => organizationId === project.organizationId) ||
    connection.projects.some(({ projectId }) => projectId === project.id)
  );
}

/**
 * The projects the client may access: the user's own project access, resolved on every request (leaving an
 * organization or losing access to a project applies right away), narrowed to what the user shared.
 */
export async function listOauthProjects({ userId, connection }: OauthAuthentication): Promise<Project[]> {
  const memberships = await dbOrganization.getUserOrganizationsWithProjects(userId);
  return memberships
    .flatMap(({ organization }) => organization.project)
    .filter((project) => connectionCoversProject(connection, project))
    .sort((a, b) => a.name.localeCompare(b.name));
}
