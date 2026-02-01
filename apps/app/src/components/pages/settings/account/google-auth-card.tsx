import { Box, Button, Card, Flex, Icon, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { TbBrandGoogleFilled, TbCheck } from 'react-icons/tb';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { getAppUrl } from '@/utils/url';

interface GoogleAuthCardProps {
  isConnected: boolean;
  hasPassword: boolean;
  hasOtherProvider: boolean;
  onUpdate: () => Promise<void>;
}

export const GoogleAuthCard = ({ isConnected, hasPassword, hasOtherProvider, onUpdate }: GoogleAuthCardProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const canUnlink = isConnected && (hasPassword || hasOtherProvider);

  const handleLink = async () => {
    setIsLoading(true);
    const result = await authClient.linkSocial({
      provider: 'google',
      callbackURL: getAppUrl() + '/?settings=auth',
    });

    if (result.error) {
      toaster.create({
        title: result.error.message || 'Failed to link Google account',
        type: 'error',
      });
    }
  };

  const handleUnlink = async () => {
    setIsLoading(true);
    const result = await authClient.unlinkAccount({
      providerId: 'google',
    });
    setIsLoading(false);

    if (result.error) {
      toaster.create({
        title: result.error.message || 'Failed to unlink Google account',
        type: 'error',
      });
    } else {
      await onUpdate();
      toaster.create({
        title: 'Google account unlinked',
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
              <TbBrandGoogleFilled />
            </Box>
            <Box>
              <Text fontWeight="semibold">Google</Text>
              <Flex align="center" gap={1}>
                <Text fontSize="sm" color="fg.muted">
                  {isConnected ? 'Your Google account is connected' : 'Connect your Google account'}
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
