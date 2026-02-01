import { Button, Input, Field, Stack, Span, HStack } from '@chakra-ui/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TbBuilding, TbUserSquareRounded } from 'react-icons/tb';
import { OnboardingLayout } from '@/components/onboard-layout';
import { SplashScreen } from '@/components/splash-screen';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { requireAuthentication } from '@/utils/auth-guards';
import { trpc } from '@/utils/trpc';

export const Route = createFileRoute('/onboarding/organization')({
  beforeLoad: requireAuthentication,
  pendingComponent: SplashScreen,
  component: Page,
});

function Page() {
  const [isLoading, setIsLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const navigate = useNavigate();
  const { data: session, refetch: refetchAuth } = authClient.useSession();

  const hasExistingOrganizations = (session?.organizations.length ?? 0) > 0;

  const { mutate } = trpc.organization.create.useMutation({
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: async ({ organizationId }) => {
      await refetchAuth();
      navigate({ to: '/onboarding/pricing', search: { orgId: organizationId } });
    },
    onError: (error) => {
      setIsLoading(false);
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // For new users, require firstName
    if (!hasExistingOrganizations && firstName.length < 2) {
      toaster.create({
        title: 'Error',
        description: 'First name must be at least 2 characters long',
        type: 'error',
      });
      return;
    }

    if (organizationName.length < 2) {
      toaster.create({
        title: 'Error',
        description: 'Organization name must be at least 2 characters long',
        type: 'error',
      });
      return;
    }

    mutate({
      firstName: hasExistingOrganizations ? undefined : firstName,
      organizationName,
    });
  };

  return (
    <OnboardingLayout
      title={hasExistingOrganizations ? 'Create a new organization' : "Let's get you started quickly"}
      description={
        hasExistingOrganizations
          ? 'Set up a new workspace for your team'
          : "We'll use this information to personalize your workspace"
      }
    >
      <Stack gap="4" w="full" maxW="sm" as="form" onSubmit={onSubmit}>
        {!hasExistingOrganizations && (
          <Field.Root>
            <Field.Label>First Name</Field.Label>
            <InputGroup startElement={<TbUserSquareRounded />} width="full">
              <Input
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
              />
            </InputGroup>
          </Field.Root>
        )}
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
        <Stack gap="2">
          <Button type="submit" loading={isLoading}>
            Create Organization
          </Button>
          {hasExistingOrganizations && (
            <Button type="button" variant="outline" onClick={() => navigate({ to: '/' })} disabled={isLoading}>
              Cancel
            </Button>
          )}
        </Stack>
        <HStack textStyle="sm" color="fg.muted" gap="1" alignSelf="center">
          Step <Span color="fg">1</Span> of 3
        </HStack>
      </Stack>
    </OnboardingLayout>
  );
}
