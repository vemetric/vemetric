import type { AuthInfo } from '@modelcontextprotocol/server';
import type { Project } from 'database';
import type { ApiKeyAuthentication } from '../api/middleware/auth';
import type { ApiServiceContext } from '../api/services/context';
import { listApiKeyProjects, resolveApiKeyProject } from '../api/utils/api-key-access';
import { ApiError } from '../api/utils/errors';

/** Who calls the MCP server. API keys for now, OAuth adds user-based callers later. */
export type McpCaller = ApiKeyAuthentication;

/** The SDK passes `authInfo` through to the server factory, so the caller rides along in `extra`. */
export function toAuthInfo(caller: McpCaller): AuthInfo {
  return {
    token: caller.apiKey.keyPrefix,
    clientId: caller.apiKey.id,
    scopes: ['analytics:read'],
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

export function listCallerProjects(caller: McpCaller): Promise<Project[]> {
  return listApiKeyProjects(caller.apiKey);
}

/**
 * The project a tool call is about. Unlike the REST API, `projectId` may be omitted whenever the credentials cover
 * exactly one project: the model recovers from a missing `projectId` by calling `list_projects`.
 */
export async function resolveCallerContext(
  caller: McpCaller,
  projectId: string | undefined,
): Promise<ApiServiceContext> {
  const project = (await resolveApiKeyProject(caller.apiKey, projectId)) ?? (await resolveOnlyProject(caller));
  return { project, subscriptionStatus: caller.subscriptionStatus };
}

async function resolveOnlyProject(caller: McpCaller): Promise<Project> {
  const projects = await listCallerProjects(caller);
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
