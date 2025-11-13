import { Box, Icon, LinkOverlay, Text } from '@chakra-ui/react';
import { useParams } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import { useOrganizationId } from '@/hooks/use-organization-id';
import { trpc } from '@/utils/trpc';

export const BlackFridayBanner = () => {
  const { projectId } = useParams({ strict: false });
  const { organizationId } = useOrganizationId(projectId);

  const { data: billingStatus, isLoading } = trpc.billing.billingStatus.useQuery({
    organizationId,
  });

  if (isLoading || billingStatus?.isActive) {
    return null;
  }

  return (
    <Box bg="bg.muted" rounded="lg" m={1} py={1.5} px={2.5} pos="relative" overflow="hidden" className="group">
      <Text fontWeight="semibold" mb="1.5">
        <LinkOverlay href="https://vemetric.com/pricing" target="_blank">
          Black Friday Deal 🎉
        </LinkOverlay>
      </Text>
      <Text fontSize="sm">Get 30% off on your first year (or month)</Text>
      <Box
        pos="absolute"
        pointerEvents="none"
        left="0"
        bottom="0"
        fontSize="sm"
        bg="bg.muted"
        py={1.5}
        px={2.5}
        opacity="0"
        transform="translateX(-50px)"
        transition="all 0.3s ease-in-out"
        _groupHover={{ opacity: '1', transform: 'translateX(0)' }}
      >
        Use the code <strong>BF2025</strong> at checkout! <Icon as={TbArrowRight} />
      </Box>
    </Box>
  );
};
