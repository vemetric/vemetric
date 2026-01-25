import { Button, Input, Field, Stack, Span, HStack, Text, Icon } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { TbDashboard, TbWorldQuestion } from 'react-icons/tb';
import { z } from 'zod';
import { LoadingImage } from '~/components/loading-image';
import { OnboardingLayout } from '~/components/onboard-layout';
import { SplashScreen } from '~/components/splash-screen';
import { InputGroup } from '~/components/ui/input-group';
import { Tooltip } from '~/components/ui/tooltip';
import { useCreateProject } from '~/hooks/use-create-project';
import { requireOnboardingProject } from '~/utils/auth-guards';
import { getFaviconUrl } from '~/utils/favicon';

const searchSchema = z.object({
  orgId: z.string(),
});

export const Route = createFileRoute('/onboarding/project')({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => requireOnboardingProject({ search }),
  pendingComponent: SplashScreen,
  component: Page,
});

function Page() {
  const { orgId } = Route.useSearch();
  const { isLoading, projectName, setProjectName, debouncedDomain, domain, setDomain, onSubmit } = useCreateProject({
    organizationId: orgId,
  });

  return (
    <OnboardingLayout
      title="Let's create your first project"
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
            <InputGroup
              startElement={
                debouncedDomain.length > 3 ? (
                  <LoadingImage boxSize="16px" src={getFaviconUrl(debouncedDomain)} />
                ) : (
                  <Icon as={TbWorldQuestion} boxSize="16px" color="#838383" />
                )
              }
              width="full"
            >
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
