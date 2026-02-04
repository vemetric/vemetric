import { AbsoluteCenter, Box, Card, Flex, Spinner, Stack, Switch, Text } from '@chakra-ui/react';
import { TbBulb, TbMail } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { ErrorState } from '@/components/ui/empty-state';
import { toaster } from '@/components/ui/toaster';
import { trpc } from '@/utils/trpc';

export const AccountNotificationsTab = () => {
  const { data: settings, error, isLoading } = trpc.account.settings.useQuery();

  if (error) {
    return <ErrorState title="Error loading settings" />;
  }

  if (isLoading) {
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

  return (
    <Flex flexDir="column" gap={4} p={4}>
      <EmailNotificationsSection receiveEmailTips={settings.user.receiveEmailTips} />
    </Flex>
  );
};

interface EmailNotificationsSectionProps {
  receiveEmailTips: boolean;
}

const EmailNotificationsSection = ({ receiveEmailTips }: EmailNotificationsSectionProps) => {
  const utils = trpc.useUtils();
  const { mutate: updateNotificationSettings, isPending } = trpc.account.updateNotificationSettings.useMutation({
    onSuccess: () => {
      utils.account.settings.invalidate();
      toaster.create({
        title: 'Notification settings updated',
        type: 'success',
      });
    },
    onError: (error) => {
      toaster.create({
        title: error.message || 'Failed to update notification settings',
        type: 'error',
      });
    },
  });

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap={2}>
          <CardIcon>
            <TbMail />
          </CardIcon>
          <Text fontWeight="semibold">Email Notifications</Text>
        </Flex>
      </Card.Header>
      <Card.Body p={4} pt={4} pb={4}>
        <Stack gap={4}>
          <Flex justify="space-between" align="center">
            <Flex align="center" gap={3}>
              <TbBulb size={18} />
              <Box>
                <Text fontWeight="medium">Tips & Best Practices</Text>
                <Text fontSize="sm" color="fg.muted">
                  Receive occasional emails with tips on how to get the most out of Vemetric
                </Text>
              </Box>
            </Flex>
            <Switch.Root
              checked={receiveEmailTips}
              disabled={isPending}
              onCheckedChange={({ checked }) => updateNotificationSettings({ receiveEmailTips: checked })}
            >
              <Switch.HiddenInput />
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Root>
          </Flex>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
};
