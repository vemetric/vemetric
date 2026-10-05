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
