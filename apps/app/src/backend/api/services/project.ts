import type { Project } from 'database';
import type { ApiServiceContext } from './context';

function splitCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The projects some credentials cover (resolved by the caller), e.g. for `GET /v1/projects`. */
export function listProjects(projects: Project[]) {
  return {
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      domain: project.domain,
    })),
  };
}

export function getProject({ project }: ApiServiceContext) {
  return {
    project: {
      id: project.id,
      name: project.name,
      domain: project.domain,
      token: project.token,
      createdAt: project.createdAt.toISOString(),
      firstEventAt: project.firstEventAt ? project.firstEventAt.toISOString() : null,
      hasPublicDashboard: project.publicDashboard,
      excludedIps: splitCsv(project.excludedIps),
      excludedCountries: splitCsv(project.excludedCountries),
    },
  };
}
