import { Box, Button, Card, Flex, Icon, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { TbBrandGithub, TbCheck } from 'react-icons/tb';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { getAppUrl } from '@/utils/url';

interface GitHubAuthCardProps {
  isConnected: boolean;
  hasPassword: boolean;
  hasOtherProvider: boolean;
  onUpdate: () => Promise<void>;
}

export const GitHubAuthCard = ({ isConnected, hasPassword, hasOtherProvider, onUpdate }: GitHubAuthCardProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const canUnlink = isConnected && (hasPassword || hasOtherProvider);

  const handleLink = async () => {
    setIsLoading(true);
    const result = await authClient.linkSocial({
      provider: 'github',
      callbackURL: getAppUrl() + '/?settings=auth',
    });

    if (result.error) {
      toaster.create({
        title: result.error.message || 'Failed to link GitHub account',
        type: 'error',
      });
    }
  };

  const handleUnlink = async () => {
    setIsLoading(true);
    const result = await authClient.unlinkAccount({
      providerId: 'github',
    });
    setIsLoading(false);

    if (result.error) {
      toaster.create({
        title: result.error.message || 'Failed to unlink GitHub account',
        type: 'error',
      });
    } else {
      await onUpdate();
      toaster.create({
        title: 'GitHub account unlinked',
        type: 'success',
      });
    }
  };

  return (
    <Card.Root>
      <Card.Body p={4}>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={3}>
            <Box fontSize="xl">
              <TbBrandGithub />
            </Box>
            <Box>
              <Text fontWeight="semibold">GitHub</Text>
              <Flex align="center" gap={1}>
                <Text fontSize="sm" color="fg.muted">
                  {isConnected ? 'Your GitHub account is connected' : 'Connect your GitHub account'}
                </Text>
                {isConnected && <Icon as={TbCheck} color="green.500" />}
              </Flex>
            </Box>
          </Flex>
          {isConnected ? (
            <Button
              size="sm"
              variant="surface"
              colorPalette="red"
              loading={isLoading}
              disabled={!canUnlink}
              onClick={handleUnlink}
            >
              Disconnect
            </Button>
          ) : (
            <Button size="sm" variant="surface" loading={isLoading} onClick={handleLink}>
              Connect
            </Button>
          )}
        </Flex>
      </Card.Body>
    </Card.Root>
  );
};
