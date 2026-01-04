import { VStack, Text, Icon } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { TbClock } from 'react-icons/tb';
import { z } from 'zod';
import { OnboardingLayout } from '@/components/onboard-layout';
import { SplashScreen } from '@/components/splash-screen';
import { requireOnboardingWaiting } from '@/utils/auth-guards';

const searchSchema = z.object({
  orgId: z.string(),
});

export const Route = createFileRoute('/onboarding/waiting')({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => requireOnboardingWaiting({ search }),
  pendingComponent: SplashScreen,
  component: Page,
});

function Page() {
  const { orgStatus } = Route.useRouteContext();

  return (
    <OnboardingLayout
      title="Waiting for setup"
      description={`The organization "${orgStatus.organization.name}" is being set up`}
    >
      <VStack gap="4" maxW="md" textAlign="center">
        <Icon as={TbClock} boxSize="12" color="fg.muted" />
        <Text color="fg.muted">
          An admin needs to complete the organization setup before you can access it. You can switch to another
          organization, or create a new one, using the menu above.
        </Text>
      </VStack>
    </OnboardingLayout>
  );
}
