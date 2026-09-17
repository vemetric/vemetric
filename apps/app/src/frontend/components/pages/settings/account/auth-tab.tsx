import { AbsoluteCenter, Box, Flex, Spinner, Stack, Text } from '@chakra-ui/react';
import { ErrorState } from '@/components/ui/empty-state';
import { authClient } from '@/utils/auth';
import { isSocialProviderEnabled } from '@/utils/social-providers';
import { trpc } from '@/utils/trpc';
import { EmailAuthCard } from './email-auth-card';
import { GitHubAuthCard } from './github-auth-card';
import { GoogleAuthCard } from './google-auth-card';

export const AccountAuthenticationTab = () => {
  const { refetch: refetchAuth } = authClient.useSession();
  const { data: settings, error, refetch, isLoading: isSettingsLoading } = trpc.account.settings.useQuery();

  if (error) {
    return <ErrorState title="Error loading settings" />;
  }

  if (isSettingsLoading) {
    return (
      <Box h="200px" pos="relative">
        <AbsoluteCenter>
          <Spinner />
        </AbsoluteCenter>
      </Box>
    );
  }

  if (!settings) {
    return <ErrorState title="Account not found" />;
  }

  const refreshData = async () => {
    await Promise.all([refetch(), refetchAuth()]);
  };

  const isGoogleEnabled = isSocialProviderEnabled('google');
  const isGitHubEnabled = isSocialProviderEnabled('github');
  const hasGoogle = Boolean(settings.accounts.find((a) => a.provider === 'google'));
  const hasGitHub = Boolean(settings.accounts.find((a) => a.provider === 'github'));
  // A linked account of a provider the instance does not offer cannot be used to sign in, so it
  // must not count as a fallback when deciding whether the other provider may be unlinked.
  const canSignInWithGoogle = isGoogleEnabled && hasGoogle;
  const canSignInWithGitHub = isGitHubEnabled && hasGitHub;

  return (
    <Flex flexDir="column" gap={4} p={4}>
      <Box>
        <Box mb={4}>
          <Text fontWeight="semibold" fontSize="lg">
            Authentication
          </Text>
          <Text fontSize="sm" color="fg.muted">
            Manage your authentication settings
          </Text>
        </Box>
        <Stack gap="3">
          <EmailAuthCard email={settings.user.email} hasPassword={settings.hasPassword} onUpdate={refreshData} />
          {isGoogleEnabled && (
            <GoogleAuthCard
              isConnected={hasGoogle}
              hasPassword={settings.hasPassword}
              hasOtherProvider={canSignInWithGitHub}
              onUpdate={refreshData}
            />
          )}
          {isGitHubEnabled && (
            <GitHubAuthCard
              isConnected={hasGitHub}
              hasPassword={settings.hasPassword}
              hasOtherProvider={canSignInWithGoogle}
              onUpdate={refreshData}
            />
          )}
        </Stack>
      </Box>
    </Flex>
  );
};
