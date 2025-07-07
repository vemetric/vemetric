import {
  Card,
  Box,
  Button,
  Field,
  Input,
  Flex,
  Stack,
  Text,
  VStack,
  Switch,
  Link,
  AbsoluteCenter,
  Spinner,
} from '@chakra-ui/react';
import { Link as RouterLink, Navigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  TbDashboard,
  TbNetwork,
  TbSettings,
  TbBrowserShare,
  TbLockX,
  TbAlertCircle,
  TbFlagCode,
  TbKey,
} from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { CodeBox } from '@/components/code-box';
import { IntegrationGuides } from '@/components/integration-guides';
import { EmptyState } from '@/components/ui/empty-state';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { trpc } from '@/utils/trpc';

interface Props {
  projectId: string;
}

export const GeneralTab = (props: Props) => {
  const { projectId } = props;
  const [isLoading, setIsLoading] = useState(false);

  const {
    data: projectSettings,
    error,
    refetch,
    isLoading: isProjectSettingsLoading,
  } = trpc.projects.settings.useQuery({ projectId });

  const { mutate: editProject } = trpc.projects.edit.useMutation({
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: async () => {
      await refetch();
      toaster.create({
        title: 'Project updated successfully',
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

  const { mutate: togglePublishDashboard, isLoading: isMutating } = trpc.projects.togglePublic.useMutation({
    onSuccess: async () => {
      await refetch();
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (projectName.length < 2) {
      toaster.create({
        title: 'Error',
        description: 'Project name must be at least 2 characters long',
        type: 'error',
      });
      return;
    }

    editProject({
      projectId,
      name: projectName,
    });
  };

  const [projectName, setProjectName] = useState(projectSettings?.name ?? '');

  useEffect(() => {
    setProjectName(projectSettings?.name ?? '');
  }, [projectSettings?.name]);

  if (error) {
    if (error?.data?.httpStatus === 403) {
      return (
        <EmptyState
          icon={<TbLockX />}
          title="You don't have admin access to this project."
          description="The settings can only be accessed by admins."
        />
      );
    }

    return <EmptyState icon={<TbAlertCircle />} title="Error loading settings" />;
  }

  if (isProjectSettingsLoading) {
    return (
      <Box h="200px" pos="relative">
        <AbsoluteCenter>
          <Spinner />
        </AbsoluteCenter>
      </Box>
    );
  }

  if (!projectSettings) {
    return <Navigate to="/" />;
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
              <Field.Label>Project Name</Field.Label>
              <InputGroup startElement={<TbDashboard />} width="full">
                <Input
                  placeholder="Wonka's Chocolate Factory"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={isLoading}
                />
              </InputGroup>
            </Field.Root>
            <Field.Root>
              <Field.Label>Domain</Field.Label>
              <InputGroup startElement={<TbNetwork />} width="full">
                <Input placeholder="example.com" value={projectSettings.domain} disabled />
              </InputGroup>
            </Field.Root>
            <Field.Root>
              <Field.Label>Public Token</Field.Label>
              <CodeBox size="sm" startElement={<TbKey />}>
                {projectSettings.token}
              </CodeBox>
            </Field.Root>
            <Flex justifyContent="flex-end">
              <Button type="submit" size="sm">
                Save
              </Button>
            </Flex>
          </Stack>
        </Card.Body>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbBrowserShare />
            </CardIcon>
            <Text fontWeight="semibold">Public Dashboard</Text>
          </Flex>
        </Card.Header>
        <Card.Body>
          <VStack align="stretch" mt={2}>
            <Switch.Root
              checked={projectSettings.publicDashboard}
              onCheckedChange={() => {
                togglePublishDashboard({
                  projectId,
                });
              }}
              disabled={isMutating}
            >
              <Switch.HiddenInput />
              <Switch.Control bg={projectSettings.publicDashboard ? 'green.500' : 'gray.emphasized'}>
                <Switch.Thumb bg="white" />
              </Switch.Control>
              <Switch.Label>Enable Public Access</Switch.Label>
            </Switch.Root>
            <Text fontSize="sm" color="fg.muted">
              When enabled, anyone with the link can view your dashboard.
            </Text>
            {projectSettings.publicDashboard && (
              <Box borderWidth={1} p={3} rounded="md" bg="bg.subtle" mt={2}>
                <Text fontSize="sm">Your public dashboard is available at:</Text>

                <Link asChild fontWeight="medium" color="blue.500" target="_blank" rel="noopener noreferrer">
                  <RouterLink to="/public/$domain" params={{ domain: projectSettings.domain }}>
                    https://app.vemetric.com/public/{projectSettings.domain}
                  </RouterLink>
                </Link>
              </Box>
            )}
          </VStack>
        </Card.Body>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbFlagCode />
            </CardIcon>
            <Text fontWeight="semibold">Installation</Text>
          </Flex>
        </Card.Header>
        <Card.Body p={4} pb={3}>
          <Text mb={3} opacity={0.9}>
            We&apos;ve prepared the following guides to help you integrate Vemetric:
          </Text>
          <IntegrationGuides />
          <Text opacity={0.85} mt={4} fontSize="sm" pl="1">
            Checkout the{' '}
            <Link color="purple.fg" fontWeight="medium" href="https://vemetric.com/docs/installation">
              installation docs
            </Link>{' '}
            for more information.
          </Text>
          <Text opacity={0.85} mt={1.5} fontSize="sm" pl="1">
            Hint: we recommend{' '}
            <Link color="purple.fg" fontWeight="medium" href="https://vemetric.com/docs/advanced-guides/using-a-proxy">
              using a proxy
            </Link>{' '}
            to send events via your own domain.
          </Text>
        </Card.Body>
      </Card.Root>
    </Flex>
  );
};
