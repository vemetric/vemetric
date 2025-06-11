import { Box, Card, Flex } from '@chakra-ui/react';
import { Outlet, createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { TbHome } from 'react-icons/tb';
import { EventLimitDialog, eventLimitStore } from '@/components/event-limit-dialog';
import { Header } from '@/components/header';
import { Logo } from '@/components/logo';
import { MobileMenu } from '@/components/mobile-menu';
import { Navigation } from '@/components/navigation';
import { PageWrapper } from '@/components/page-wrapper';
import { TabletHeader } from '@/components/tablet-header';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { toaster } from '@/components/ui/toaster';
import { useOrganizationId } from '@/hooks/use-organization-id';
import { getPricingPlan } from '@/utils/pricing';
import { trpc } from '@/utils/trpc';

const BackgroundSvg = () => (
  <svg width="768" height="635" viewBox="0 0 768 635" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#filter0_f_356_81)">
      <ellipse
        cx="383.998"
        cy="317.589"
        rx="200.508"
        ry="295.711"
        transform="rotate(67.4476 383.998 317.589)"
        fill="url(#paint0_linear_356_81)"
        fillOpacity="0.04"
      />
    </g>
    <defs>
      <filter
        id="filter0_f_356_81"
        x="0.207397"
        y="0.411484"
        width="767.581"
        height="634.354"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feGaussianBlur stdDeviation="50" result="effect1_foregroundBlur_356_81" />
      </filter>
      <linearGradient
        id="paint0_linear_356_81"
        x1="383.998"
        y1="21.8777"
        x2="383.998"
        y2="613.299"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FF00FF" stopOpacity="0.5" />
        <stop offset="1" stopColor="#0000FF" stopOpacity="0.82" />
      </linearGradient>
    </defs>
  </svg>
);

let shownPastDueToast = false;

export const Route = createFileRoute('/_layout')({
  component: LayoutComponent,
});

function LayoutComponent() {
  const hostname = location.hostname.split('.').slice(-2).join('.');
  const { projectId } = useParams({ strict: false });
  const { organizationId } = useOrganizationId(projectId);
  const navigate = useNavigate();

  const { data: billingStatus } = trpc.billing.billingStatus.useQuery({
    organizationId,
  });

  const eventsUsed = billingStatus?.usageStats?.total ?? 0;
  const { eventsIncluded } = getPricingPlan(billingStatus);
  useEffect(() => {
    if (eventLimitStore.organizationId !== organizationId) {
      eventLimitStore.organizationId = organizationId;
      eventLimitStore.hasClosedEventLimitDialog = false;
      shownPastDueToast = false;
    }

    if (eventsUsed > eventsIncluded) {
      eventLimitStore.showEventLimitDialog = true;
    }

    if (billingStatus?.isPastDue && !shownPastDueToast) {
      shownPastDueToast = true;
      toaster.create({
        title: 'Payment failed',
        description: 'Please make sure your payment method is up to date to continue using Vemetric.',
        duration: 9999999,
        type: 'warning',
        id: 'subscription-past-due',
        action: {
          label: 'Update payment method',
          onClick: () => {
            if (projectId) {
              navigate({ to: '/p/$projectId/settings', params: { projectId }, search: { tab: 'billing' } });
            }
          },
        },
      });
    }
  }, [billingStatus, billingStatus?.isPastDue, eventsUsed, eventsIncluded, organizationId, projectId, navigate]);

  return (
    <>
      <Box pos="absolute" left={0} top={0} w="100%" maxW="100vw" h="100dvh" overflow="hidden" opacity={0.6}>
        <Box
          bg="purple.500"
          w="200vw"
          h="150dvh"
          rounded="100%"
          pos="fixed"
          bottom="-60dvh"
          left="-50vw"
          filter="blur(50px)"
          opacity={0.05}
        ></Box>
        <Box pos="fixed" left="-480px" top="50px">
          <BackgroundSvg />
        </Box>
        <Box pos="fixed" right="-280px" bottom="-200px" transform="scale(-1)">
          <BackgroundSvg />
        </Box>
      </Box>
      <PageWrapper gap={4} px={{ base: 0, md: 3 }} pt={{ base: 0, lg: 1 }} pb={{ base: 0, md: 8 }} pos="relative">
        <Flex
          display={{ base: 'none', lg: 'flex' }}
          pos="sticky"
          top={4}
          flexDir="column"
          gap={4}
          align="center"
          height="max-content"
        >
          <MenuRoot positioning={{ sameWidth: true }}>
            <MenuTrigger textAlign="left">
              <Logo />
            </MenuTrigger>
            <MenuContent>
              <MenuItem asChild value="home">
                <a href={'https://' + hostname}>
                  <TbHome size="18px" /> Home Page
                </a>
              </MenuItem>
            </MenuContent>
          </MenuRoot>
          <Navigation />
        </Flex>
        <Flex w="100%" flexDir="column">
          <Flex w="100%" flexDir="column">
            <TabletHeader />
            <Box flexGrow={1} position="relative">
              <Header />
              <Card.Root
                borderWidth={{ base: '0px', md: '1px' }}
                rounded={{ base: 'none', md: 'lg' }}
                borderTop="none"
                roundedTop="none!important"
                position="relative"
              >
                <Box
                  as="main"
                  flexGrow={1}
                  px={{ base: 2, md: 3 }}
                  pt={3}
                  pb={{ base: 6, md: 3 }}
                  bg="bg.content"
                  roundedBottom="xl"
                  minH={{ base: '90dvh', md: '80dvh', lg: '88dvh' }}
                >
                  <Outlet key={projectId ?? 'noproject'} />
                </Box>
              </Card.Root>
            </Box>
          </Flex>
          <MobileMenu />
        </Flex>
        <EventLimitDialog
          projectId={projectId ?? ''}
          usageStats={billingStatus?.usageStats}
          eventsIncluded={eventsIncluded}
        />
      </PageWrapper>
    </>
  );
}
