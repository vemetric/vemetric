import { useParams, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { authClient } from '~/utils/auth';

export function useCurrentOrganization() {
  const { data: session, isPending } = authClient.useSession();
  const { organizations, projects } = session ?? {};

  const { organizationId, projectId } = useParams({ strict: false });
  const { orgId } = useSearch({ strict: false });
  const resolvedOrganizationId =
    organizationId || orgId || projects?.find((p) => p.id === projectId)?.organizationId || '';

  const currentOrganization = organizations?.find((org) => org.id === resolvedOrganizationId);
  const currentUserRole = currentOrganization?.role;
  const isAdmin = currentUserRole === 'ADMIN';
  const isOnboarded = currentOrganization?.pricingOnboarded && (currentOrganization?.project ?? []).length > 0;

  const currentOrgaProjects = useMemo(() => {
    if (!currentOrganization || !projects) return [];
    return projects.filter((p) => p.organizationId === currentOrganization.id);
  }, [currentOrganization, projects]);

  return {
    isPending,
    projectId,
    organizationId: resolvedOrganizationId,
    currentOrganization,
    currentOrgaProjects,
    currentUserRole,
    isAdmin,
    isOnboarded,
    organizations,
    firstOrganization: organizations?.[0],
  };
}
