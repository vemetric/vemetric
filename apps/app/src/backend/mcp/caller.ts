import type { AuthInfo } from '@modelcontextprotocol/server';
import { dbOrganization, type Project } from 'database';
import { listOauthProjects, type OauthAuthentication } from './oauth';
import type { ApiKeyAuthentication } from '../api/middleware/auth';
import type { ApiServiceContext } from '../api/services/context';
import { listApiKeyProjects, resolveApiKeyProject } from '../api/utils/api-key-access';
import { ApiError } from '../api/utils/errors';
import { getSubscriptionStatus } from '../utils/billing';
import { MCP_SCOPE } from '../utils/oauth-consts';

/**
 * Who calls the MCP server: an API key (project or organization key), or a user who connected an OAuth client and
 * shared some of their organizations and projects with it.
 */
export type McpCaller = ({ kind: 'apiKey' } & ApiKeyAuthentication) | ({ kind: 'oauth' } & OauthAuthentication);

/** The SDK passes `authInfo` through to the server factory, so the caller rides along in `extra`. */
export function toAuthInfo(caller: McpCaller): AuthInfo {
  return {
    token: caller.kind === 'apiKey' ? caller.apiKey.keyPrefix : caller.clientId,
    clientId: caller.kind === 'apiKey' ? caller.apiKey.id : caller.clientId,
    scopes: [MCP_SCOPE],
    extra: { caller },
  };
}

export function getCaller(authInfo: AuthInfo | undefined): McpCaller {
  const caller = authInfo?.extra?.caller as McpCaller | undefined;
  if (!caller) {
    throw new Error('MCP request without an authenticated caller');
  }
  return caller;
}

/** Identifies the caller in rate limit keys and logs: the API key, or the user's connection to an OAuth client. */
export function getCallerKey(caller: McpCaller): string {
  return caller.kind === 'apiKey' ? `key:${caller.apiKey.id}` : `oauth:${caller.connection.id}`;
}

export function getCallerLogFields(caller: McpCaller) {
  return caller.kind === 'apiKey'
    ? { apiKeyId: caller.apiKey.id, organizationId: caller.apiKey.organizationId }
    : { oauthClientId: caller.clientId, userId: caller.userId };
}

export function listCallerProjects(caller: McpCaller): Promise<Project[]> {
  return caller.kind === 'apiKey' ? listApiKeyProjects(caller.apiKey) : listOauthProjects(caller);
}

function projectNotFound() {
  return new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found or not shared with this app');
}

/**
 * The project a tool call is about. Unlike the REST API, `projectId` may be omitted whenever the credentials cover
 * exactly one project: the model recovers from a missing `projectId` by calling `list_projects`.
 */
export async function resolveCallerContext(
  caller: McpCaller,
  projectId: string | undefined,
): Promise<ApiServiceContext> {
  if (caller.kind === 'apiKey') {
    const project = (await resolveApiKeyProject(caller.apiKey, projectId)) ?? (await resolveOnlyProject(caller));
    return { project, subscriptionStatus: caller.subscriptionStatus };
  }

  const projects = await listCallerProjects(caller);
  const project = projectId === undefined ? onlyProject(projects) : projects.find(({ id }) => id === projectId);
  if (!project) {
    throw projectNotFound();
  }

  // An OAuth connection can span organizations, so the plan (and with it the retention) is the project's.
  const organization = await dbOrganization.findById(project.organizationId);
  if (!organization) {
    throw projectNotFound();
  }
  return { project, subscriptionStatus: await getSubscriptionStatus(organization) };
}

async function resolveOnlyProject(caller: McpCaller): Promise<Project> {
  return onlyProject(await listCallerProjects(caller));
}

function onlyProject(projects: Project[]): Project {
  if (projects.length === 1) {
    return projects[0];
  }
  throw new ApiError(
    400,
    'PROJECT_REQUIRED',
    projects.length === 0
      ? 'These credentials have no access to any project.'
      : 'These credentials cover several projects, so projectId is required.',
  );
}
