import { AbsoluteCenter, Box, Flex, Spinner, Stack, Text } from '@chakra-ui/react';
import { ErrorState } from '@/components/ui/empty-state';
import { authClient } from '@/utils/auth';
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

  const googleAccountId = settings.accounts.find((a) => a.provider === 'google')?.id;
  const githubAccountId = settings.accounts.find((a) => a.provider === 'github')?.id;

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
          <GoogleAuthCard
            accountId={googleAccountId}
            hasPassword={settings.hasPassword}
            hasOtherProvider={Boolean(githubAccountId)}
            onUpdate={refreshData}
          />
          <GitHubAuthCard
            accountId={githubAccountId}
            hasPassword={settings.hasPassword}
            hasOtherProvider={Boolean(googleAccountId)}
            onUpdate={refreshData}
          />
        </Stack>
      </Box>
    </Flex>
  );
};
