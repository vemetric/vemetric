import { useParams, useSearch } from '@tanstack/react-router';
import { authClient } from '@/utils/auth';

export function useCurrentOrganization() {
  const { data: session } = authClient.useSession();
  const { organizations, projects } = session ?? {};

  const { organizationId, projectId } = useParams({ strict: false });
  const { orgId } = useSearch({ strict: false });
  const resolvedOrganizationId =
    organizationId || orgId || projects?.find((p) => p.id === projectId)?.organizationId || '';

  const currentOrganization = organizations?.find((org) => org.id === resolvedOrganizationId);

  return {
    projectId,
    organizationId: resolvedOrganizationId,
    currentOrganization,
    organizations,
    firstOrganization: organizations?.[0],
  };
}
