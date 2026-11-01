import { dbProject, type AuthenticatedApiKey, type Project } from 'database';
import { ApiError } from './errors';

/** The request header that names the project an organization key's request is about. */
export const PROJECT_HEADER = 'X-Vemetric-Project';

function projectNotFound() {
  return new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found or not covered by this API key');
}

/** Whether an organization key covers the project. */
function coversProject(apiKey: AuthenticatedApiKey, project: Project) {
  return (
    project.organizationId === apiKey.organizationId &&
    (apiKey.allProjects || apiKey.projects.some(({ projectId }) => projectId === project.id))
  );
}

/** All projects the key covers: its own project for a project key. */
export async function listApiKeyProjects(apiKey: AuthenticatedApiKey): Promise<Project[]> {
  if (apiKey.project) {
    return [apiKey.project];
  }

  const projects = apiKey.allProjects
    ? await dbProject.findByOrganizationId({ organizationId: apiKey.organizationId })
    : await dbProject.findByIds({
        ids: apiKey.projects.map(({ projectId }) => projectId),
        organizationId: apiKey.organizationId,
      });
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Organization keys always need to name the project, even when they cover only one project, so an integration
 * doesn't break once a second project is created.
 */
export function projectRequiredError() {
  return new ApiError(
    400,
    'PROJECT_REQUIRED',
    `Organization API keys need the project ID in the ${PROJECT_HEADER} header. GET /v1/projects lists the projects this key covers.`,
  );
}

/**
 * The project a request names: a project key's own project (`requestedProjectId` must match it if given), or the
 * covered project in `requestedProjectId` for an organization key. `undefined` for an organization key without it.
 */
export async function resolveApiKeyProject(
  apiKey: AuthenticatedApiKey,
  requestedProjectId: string | undefined,
): Promise<Project | undefined> {
  if (apiKey.project) {
    if (requestedProjectId !== undefined && requestedProjectId !== apiKey.project.id) {
      throw projectNotFound();
    }
    return apiKey.project;
  }

  if (requestedProjectId === undefined) {
    return undefined;
  }

  const project = await dbProject.findById(requestedProjectId);
  if (!project || !coversProject(apiKey, project)) {
    throw projectNotFound();
  }
  return project;
}
