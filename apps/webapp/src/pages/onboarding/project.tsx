import { Button, Input, Field, Stack, Span, HStack, Text } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { TbNetwork, TbDashboard } from 'react-icons/tb';
import { OnboardingLayout } from '@/components/onboard-layout';
import { InputGroup } from '@/components/ui/input-group';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { useCreateProject } from '@/hooks/use-create-project';

export const Route = createFileRoute('/onboarding/project')({
  component: Page,
});

function Page() {
  const { refetchAuth } = useAuth();
  const { isLoading, projectName, setProjectName, domain, setDomain, onSubmit } = useCreateProject({
    onSuccess: () => {
      refetchAuth();
    },
  });

  return (
    <OnboardingLayout
      title="Now let's create your first project"
      description="We're excited to help you gain more insights!"
    >
      <Stack gap="4" w="full" maxW="sm" as="form" onSubmit={onSubmit}>
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
          <Tooltip
            positioning={{ placement: 'bottom-start' }}
            closeOnClick={false}
            closeOnPointerDown={false}
            closeOnScroll={false}
            content={
              <>
                <Text>
                  Vemetric supports tracking across subdomains. (e.g. your landing page is on example.com, and your app
                  is on dashboard.example.com)
                </Text>
                <Text mt={2}>Therefore we&apos;d suggest to use the root domain for your project.</Text>
              </>
            }
          >
            <InputGroup startElement={<TbNetwork />} width="full">
              <Input
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={isLoading}
              />
            </InputGroup>
          </Tooltip>
        </Field.Root>
        <Button type="submit" loading={isLoading}>
          Create Project
        </Button>
        <HStack textStyle="sm" color="fg.muted" gap="1" alignSelf="center">
          Step <Span color="fg">3</Span> of 3
        </HStack>
      </Stack>
    </OnboardingLayout>
  );
}
