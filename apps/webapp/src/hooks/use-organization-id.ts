import { authClient } from '@/utils/auth';

export function useOrganizationId(projectId: string | undefined) {
  const { data: session } = authClient.useSession();
  const organizationId = session?.projects.find((project) => project.id === projectId)?.organizationId ?? '';
  return { organizationId };
}
