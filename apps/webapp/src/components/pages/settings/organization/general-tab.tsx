import { Card, Box, Button, Field, Input, Flex, Stack, Text, AbsoluteCenter, Spinner } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { TbBuilding, TbSettings, TbLockX } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { trpc } from '@/utils/trpc';

interface Props {
  organizationId: string;
}

export const OrganizationGeneralTab = (props: Props) => {
  const { organizationId } = props;
  const { refetch: refetchAuth } = authClient.useSession();
  const [isLoading, setIsLoading] = useState(false);

  const {
    data: settings,
    error,
    refetch,
    isLoading: isSettingsLoading,
  } = trpc.organization.settings.useQuery({ organizationId });

  const { mutate: updateSettings } = trpc.organization.updateSettings.useMutation({
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: async () => {
      await Promise.all([refetch(), refetchAuth()]);
      toaster.create({
        title: 'Organization updated successfully',
        type: 'success',
      });
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (organizationName.length < 2) {
      toaster.create({
        title: 'Error',
        description: 'Organization name must be at least 2 characters long',
        type: 'error',
      });
      return;
    }

    updateSettings({
      organizationId,
      name: organizationName,
    });
  };

  const [organizationName, setOrganizationName] = useState(settings?.name ?? '');

  useEffect(() => {
    setOrganizationName(settings?.name ?? '');
  }, [settings?.name]);

  if (error) {
    if (error?.data?.httpStatus === 403) {
      return (
        <EmptyState
          icon={<TbLockX />}
          title="You don't have admin access to this organization."
          description="The settings can only be accessed by admins."
        />
      );
    }

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
    return <ErrorState title="Organization not found" />;
  }

  return (
    <Flex flexDir="column" gap={6}>
      <Card.Root>
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbSettings />
            </CardIcon>
            <Text fontWeight="semibold">General Settings</Text>
          </Flex>
        </Card.Header>
        <Card.Body p={4} pb={3}>
          <Stack gap="4" as="form" onSubmit={onSubmit}>
            <Field.Root>
              <Field.Label>Organization Name</Field.Label>
              <InputGroup startElement={<TbBuilding />} width="full">
                <Input
                  placeholder="Acme Inc."
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  disabled={isLoading}
                />
              </InputGroup>
            </Field.Root>
            <Flex justifyContent="flex-end">
              <Button type="submit" size="sm" loading={isLoading}>
                Save
              </Button>
            </Flex>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Flex>
  );
};
