import { useAuth } from './use-auth';

export function useOrganizationId(projectId: string | undefined) {
  const { session } = useAuth();
  const organizationId = session?.projects.find((project) => project.id === projectId)?.organizationId ?? '';
  return { organizationId };
}
