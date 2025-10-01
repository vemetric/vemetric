import type { CardRootProps } from '@chakra-ui/react';
import { List, Box, Flex, Card, SimpleGrid, Button, Stack, Span, HStack, Text } from '@chakra-ui/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import { OnboardingLayout } from '@/components/onboard-layout';
import { PricingSlider } from '@/components/pages/settings/billing/pricing-slider';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { useOpenCrispChat } from '@/stores/crisp-chat-store';
import { authClient } from '@/utils/auth';
import { requireOnboardingPricing } from '@/utils/auth-guards';
import { openPaddleCheckout } from '@/utils/paddle';
import { PRICING_PLANS } from '@/utils/pricing';
import { trpc } from '@/utils/trpc';

const PricingCard = (props: CardRootProps) => {
  return <Card.Root p={5} borderWidth="1.5px" borderColor="gray.emphasized" rounded="xl" pos="relative" {...props} />;
};

export const Route = createFileRoute('/onboarding/pricing')({
  beforeLoad: requireOnboardingPricing,
  component: Page,
});

function Page() {
  const { data: session, refetch: refetchAuth } = authClient.useSession();
  const openCrispChat = useOpenCrispChat();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [isYearly, setIsYearly] = useState(false);
  const pricingPlan = PRICING_PLANS[sliderValue];

  const { mutate } = trpc.organization.pricingOnboarding.useMutation({
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: async () => {
      await refetchAuth();
      navigate({ to: '/onboarding/project' });
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

  return (
    <OnboardingLayout
      title="How many events are you going to track?"
      description="Choose the plan that fits your needs"
    >
      <Stack gap="4" w="full" align="center">
        <SimpleGrid gap="6" w="full" maxW="1000px" columns={{ base: 1, md: 2 }}>
          <PricingCard order={{ base: 2, md: 1 }}>
            <Text fontSize="2xl" fontWeight="semibold">
              Free
            </Text>
            <Text opacity={0.9} mb={8}>
              For small projects to get started
            </Text>
            <Box flexGrow={1} />
            <Stack gap="8">
              <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                <Box lineHeight="1.25">
                  <Text fontSize="3xl" fontWeight="medium">
                    {(2500).toLocaleString()}
                  </Text>
                  <Text fontSize="xl" color="fg.muted">
                    <Tooltip content="Pageviews + Custom Events">
                      <Text as="span" borderBottom="2px dashed" borderColor="fg.subtle">
                        events
                      </Text>
                    </Tooltip>{' '}
                    per month
                  </Text>
                </Box>

                <Flex align="flex-end">
                  <Text fontSize="4xl" lineHeight={1} fontWeight="medium">
                    $0
                  </Text>
                </Flex>
              </Flex>
              <Button
                py={2}
                px={4}
                fontSize="lg"
                fontWeight="medium"
                variant="surface"
                borderRadius="lg"
                width="full"
                loading={isLoading}
                onClick={() => {
                  mutate();
                }}
              >
                Start for free
              </Button>
            </Stack>
            <List.Root variant="plain" opacity={0.8} mt={6} gap={1}>
              <List.Item>
                <List.Indicator asChild>
                  <TbChevronRight />
                </List.Indicator>
                2 projects
              </List.Item>
              <List.Item>
                <List.Indicator asChild>
                  <TbChevronRight />
                </List.Indicator>
                2 seats
              </List.Item>
              <List.Item>
                <List.Indicator asChild>
                  <TbChevronRight />
                </List.Indicator>
                1 month of data retention
              </List.Item>
            </List.Root>
          </PricingCard>
          <PricingCard borderColor="purple.300" order={{ base: 1, md: 2 }}>
            <Text fontSize="2xl" fontWeight="semibold" color="purple.500" _dark={{ color: 'purple.300' }}>
              Professional
            </Text>
            <Text opacity={0.9} mb={8}>
              Powerful insights for your business
            </Text>
            <Stack gap="8">
              <PricingSlider
                pricingPlanIndex={sliderValue}
                setPricingPlanIndex={setSliderValue}
                isYearly={isYearly}
                setIsYearly={setIsYearly}
              />
              {pricingPlan.price >= 0 ? (
                <Button
                  py={2}
                  px={4}
                  fontSize="lg"
                  fontWeight="medium"
                  borderRadius="lg"
                  width="full"
                  colorPalette="purple"
                  loading={isLoading}
                  onClick={() => {
                    openPaddleCheckout({
                      organizationId: session?.organizations[0].id ?? '',
                      email: session?.user.email ?? '',
                      pricingPlan,
                      isYearly,
                    });
                  }}
                >
                  Choose Professional
                </Button>
              ) : (
                <Button
                  py={2}
                  px={4}
                  fontSize="lg"
                  fontWeight="medium"
                  borderRadius="lg"
                  width="full"
                  colorPalette="purple"
                  textDecor="none"
                  onClick={() => {
                    openCrispChat();
                  }}
                >
                  Contact us
                </Button>
              )}
            </Stack>
            <List.Root variant="plain" opacity={0.9} mt={6} gap={1}>
              <List.Item>
                <List.Indicator asChild color="purple.500" _dark={{ color: 'purple.300' }}>
                  <TbChevronRight />
                </List.Indicator>
                Unlimited projects
              </List.Item>
              <List.Item>
                <List.Indicator asChild color="purple.500" _dark={{ color: 'purple.300' }}>
                  <TbChevronRight />
                </List.Indicator>
                Unlimited seats
              </List.Item>
              <List.Item>
                <List.Indicator asChild color="purple.500" _dark={{ color: 'purple.300' }}>
                  <TbChevronRight />
                </List.Indicator>
                5 years of data retention
              </List.Item>
            </List.Root>
          </PricingCard>
        </SimpleGrid>
        <HStack textStyle="sm" color="fg.muted" gap="1" alignSelf="center">
          Step <Span color="fg">2</Span> of 3
        </HStack>
      </Stack>
    </OnboardingLayout>
  );
}
