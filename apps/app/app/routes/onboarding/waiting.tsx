import { VStack, Text, Icon } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { TbClock } from 'react-icons/tb';
import { z } from 'zod';
import { OnboardingLayout } from '~/components/onboard-layout';
import { SplashScreen } from '~/components/splash-screen';
import { useCurrentOrganization } from '~/hooks/use-current-organization';
import { requireOnboardingWaiting } from '~/utils/auth-guards';

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
  const { currentOrganization } = useCurrentOrganization();

  return (
    <OnboardingLayout
      icon={<Icon as={TbClock} boxSize="16" color="purple.500" />}
      title="An Admin needs to finish the setup"
    >
      <VStack gap="6" maxW="xl" textAlign="center">
        <VStack gap="3">
          <Text color="fg.muted" lineHeight="tall">
            The organization <b>{currentOrganization?.name}</b> is being set up. Once the onboarding process is
            complete, you&apos;ll get access to the full analytics dashboard.
          </Text>
          <Text color="fg.muted" maxW="sm" fontSize="sm" mt="2">
            In the meantime, you can also switch to another organization or create a new one using the menu above.
          </Text>
        </VStack>
      </VStack>
    </OnboardingLayout>
  );
}
