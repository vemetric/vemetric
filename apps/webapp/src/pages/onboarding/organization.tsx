import { Button, Input, Field, Stack, Span, HStack } from '@chakra-ui/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TbBuilding, TbUserSquareRounded } from 'react-icons/tb';
import { OnboardingLayout } from '@/components/onboard-layout';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/utils/trpc';

export const Route = createFileRoute('/onboarding/organization')({
  component: Page,
});

function Page() {
  const [isLoading, setIsLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const navigate = useNavigate();
  const { refetchAuth } = useAuth();
  const { mutate } = trpc.organization.create.useMutation({
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: async () => {
      await refetchAuth();
      navigate({ to: '/onboarding/project' });
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

    if (firstName.length < 2 || organizationName.length < 2) {
      toaster.create({
        title: 'Error',
        description: 'First name and organization name must be at least 2 characters long',
        type: 'error',
      });
      return;
    }

    mutate({
      firstName,
      organizationName,
    });
  };

  return (
    <OnboardingLayout
      title="Let's get you started quickly"
      description="We'll use this information to personalize your workspace"
    >
      <Stack gap="4" w="full" maxW="sm" as="form" onSubmit={onSubmit}>
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
        <Button type="submit" loading={isLoading}>
          Create Organization
        </Button>
        <HStack textStyle="sm" color="fg.muted" gap="1" alignSelf="center">
          Step <Span color="fg">1</Span> of 3
        </HStack>
      </Stack>
    </OnboardingLayout>
  );
}
