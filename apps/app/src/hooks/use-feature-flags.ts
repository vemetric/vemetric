import { authClient } from '@/utils/auth';

/**
 * Check if a specific feature flag is enabled for a particular organization
 * @param organizationId The ID of the organization to check
 * @param flagName The name of the feature flag to check
 * @returns True if the flag is enabled for the specified organization
 */
export const useFeatureFlags = (projectId: string | undefined | null) => {
  const { data: session } = authClient.useSession();

  return {
    hasFeatureFlag: (flagName: string) => {
      const project = session?.projects.find((project) => project.id === projectId);

      if (!project || !session?.organizations || session.organizations.length === 0) {
        return false;
      }

      const organization = session.organizations.find((org) => org.id === project.organizationId);
      if (!organization || !organization.featureFlags) {
        return false;
      }

      return organization.featureFlags
        .split(',')
        .map((flag) => (flag || '').trim())
        .includes(flagName);
    },
  };
};
