import { Box, Icon, LinkOverlay, Text } from '@chakra-ui/react';
import { Link } from '@tanstack/react-router';
import { TbArrowRight, TbBolt } from 'react-icons/tb';
import { useCurrentOrganization } from '@/hooks/use-current-organization';
import { getPricingPlan } from '@/utils/pricing';
import { trpc } from '@/utils/trpc';

export const EventLimitBanner = () => {
  const { organizationId, projectId } = useCurrentOrganization();

  const { data: billingStatus } = trpc.billing.billingStatus.useQuery({
    organizationId,
  });
  const { showLimitWarning } = getPricingPlan(billingStatus);

  if (!showLimitWarning) {
    return null;
  }

  return (
    <Box bg="red.muted/30" rounded="lg" m={1} py={2} px={3} pos="relative" overflow="hidden" className="group">
      <Text fontWeight="semibold" mb="1">
        <LinkOverlay asChild color="red.fg">
          <Link
            to="/p/$projectId/settings"
            params={{ projectId: projectId! }}
            search={{ tab: 'billing', pricingDialog: true }}
          >
            You&apos;ve exceeded your events limit{' '}
            <Icon asChild display="inline-block">
              <TbBolt />
            </Icon>
          </Link>
        </LinkOverlay>
      </Text>
      <Text fontSize="sm" color="red.fg/90">
        Please upgrade to a higher plan
        <Icon
          asChild
          display="inline-block"
          ml="0.5"
          transition="transform 0.2s"
          _groupHover={{ transform: 'translateX(2px)' }}
        >
          <TbArrowRight />
        </Icon>
      </Text>
    </Box>
  );
};
