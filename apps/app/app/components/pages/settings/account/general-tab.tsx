import { AbsoluteCenter, Box, Button, Card, Flex, Input, Spinner, Stack, Text, Field } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { TbSettings, TbUser } from 'react-icons/tb';
import { CardIcon } from '~/components/card-icon';
import { AvatarSection } from '~/components/pages/settings/account/avatar-section';
import { ErrorState } from '~/components/ui/empty-state';
import { InputGroup } from '~/components/ui/input-group';
import { toaster } from '~/components/ui/toaster';
import { authClient } from '~/utils/auth';
import { trpc } from '~/utils/trpc';

export const AccountGeneralTab = () => {
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

  return (
    <Flex flexDir="column" gap={4} p={4}>
      <ProfileSection name={settings.user.name ?? ''} onUpdate={refreshData} />
    </Flex>
  );
};

interface ProfileSectionProps {
  name: string;
  onUpdate: () => Promise<void>;
}

const ProfileSection = ({ name: initialName, onUpdate }: ProfileSectionProps) => {
  const [isNameLoading, setIsNameLoading] = useState(false);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (name.length < 2) {
      toaster.create({
        title: 'Name must be at least 2 characters',
        type: 'error',
      });
      return;
    }

    setIsNameLoading(true);
    const result = await authClient.updateUser({ name });
    setIsNameLoading(false);

    if (result.error) {
      toaster.create({
        title: result.error.message || 'Failed to update name',
        type: 'error',
      });
    } else {
      await onUpdate();
      toaster.create({
        title: 'Name updated successfully',
        type: 'success',
      });
    }
  };

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap={2}>
          <CardIcon>
            <TbSettings />
          </CardIcon>
          <Text fontWeight="semibold">General Settings</Text>
        </Flex>
      </Card.Header>
      <Card.Body p={4} pt={6} pb={3} gap={5}>
        <Flex gap="8" flexDirection="row">
          <AvatarSection onUpdate={onUpdate} />
          <Stack gap="4" as="form" onSubmit={handleNameUpdate} flexGrow="1">
            <Field.Root>
              <Field.Label>Name</Field.Label>
              <InputGroup startElement={<TbUser />} width="full">
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isNameLoading}
                />
              </InputGroup>
            </Field.Root>
            <Flex justifyContent="flex-end">
              <Button type="submit" size="sm" loading={isNameLoading} disabled={name === initialName}>
                Update Name
              </Button>
            </Flex>
          </Stack>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
};
