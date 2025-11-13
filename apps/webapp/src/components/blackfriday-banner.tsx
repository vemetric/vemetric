import { Box, Flex, Icon, LinkOverlay, Tag, Text, useClipboard } from '@chakra-ui/react';
import { Link, useParams } from '@tanstack/react-router';
import { TbArrowRight, TbCheck } from 'react-icons/tb';
import { useOrganizationId } from '@/hooks/use-organization-id';
import { trpc } from '@/utils/trpc';

export const BlackFridayBanner = () => {
  const { projectId } = useParams({ strict: false });
  const { organizationId } = useOrganizationId(projectId);
  const { copied, copy } = useClipboard({ value: 'BF2025' });

  const { data: billingStatus } = trpc.billing.billingStatus.useQuery({
    organizationId,
  });

  if (!billingStatus || billingStatus?.isActive) {
    return null;
  }

  return (
    <Box bg="bg.muted" rounded="lg" m={1} py={1.5} px={2.5} pos="relative" overflow="hidden" className="group">
      <Text fontWeight="semibold" mb="1.5">
        <LinkOverlay asChild>
          <Link
            to="/p/$projectId/settings"
            params={{ projectId: projectId! }}
            search={{ tab: 'billing' }}
            onClick={copy}
          >
            Black Friday Deal 🎉
          </Link>
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
        transition="all 0.2s ease-in-out"
        _groupHover={{ opacity: '1', transform: 'translateX(0)' }}
      >
        Use the code <strong>BF2025</strong> at checkout! <Icon as={TbArrowRight} />
      </Box>
      <Flex
        justify="center"
        w="100%"
        pos="absolute"
        left="0"
        bottom="2"
        pointerEvents="none"
        opacity={copied ? 1 : 0}
        transform={copied ? 'translateY(0)' : 'translateY(10px)'}
        transition="all 0.2s ease-in-out"
      >
        <Tag.Root colorPalette="green" size="sm">
          <Tag.StartElement>
            <TbCheck />
          </Tag.StartElement>
          <Tag.Label>Copied to Clipboard</Tag.Label>
        </Tag.Root>
      </Flex>
    </Box>
  );
};
