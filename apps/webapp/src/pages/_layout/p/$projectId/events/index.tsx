import type { FlexProps } from '@chakra-ui/react';
import { Box, Flex, Text, AbsoluteCenter } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { TbBolt, TbChevronRight, TbExternalLink, TbEye } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { useSetBreadcrumbs, useSetDocsLink } from '@/stores/header-store';

interface EventCardProps extends FlexProps {
  icon: React.ReactNode;
  name: string;
}

function EventCard({ icon, name, ...props }: EventCardProps) {
  return (
    <Flex
      flexDir="column"
      justify="center"
      w="100%"
      maxW={{ base: '90%', md: '550px' }}
      h="80px"
      px={4}
      border="1.5px solid"
      borderColor="gray.emphasized"
      rounded="md"
      bg="bg.card"
      roundedTop="none"
      {...props}
    >
      <Flex align="center" gap={3}>
        <CardIcon>{icon}</CardIcon>
        <Text fontWeight="semibold">{name}</Text>
        <Box flexGrow={1} />
        <TbChevronRight />
      </Flex>
    </Flex>
  );
}

export const Route = createFileRoute('/_layout/p/$projectId/events/')({
  component: RouteComponent,
});

function RouteComponent() {
  /* TODO: 
  const { projectId } = Route.useParams();

  const { data: funnelResults } = trpc.funnels.getFunnelResults.useQuery({ projectId }); */

  useSetBreadcrumbs(['Events']);
  useSetDocsLink('https://vemetric.com/docs/product-analytics/tracking-custom-events');

  return (
    <Box pos="relative">
      <Flex
        pos="relative"
        flexDir="column"
        align="center"
        justify="center"
        border="1px solid"
        borderColor="gray.emphasized"
        rounded="md"
        minH="70dvh"
        opacity="0.2"
        css={{
          '& > div:not(:last-of-type)': {
            borderBottom: 'none',
            roundedBottom: 'none',
          },
          '& > div:first-of-type': {
            roundedTop: 'md',
          },
        }}
      >
        <EventCard icon={<TbEye />} name="Page view" />
        <EventCard icon={<TbBolt />} name="Opened Dashboard" />
        <EventCard icon={<TbExternalLink />} name="Outbound Link Click" />
        <EventCard icon={<TbEye />} name="Page view" />
      </Flex>
      <AbsoluteCenter zIndex="10">
        <Box pos="relative" px={14} py={10}>
          <Box
            pos="absolute"
            inset="0"
            bg="bg.card"
            rounded="full"
            boxShadow="lg"
            border="0.5px solid"
            borderColor="gray.emphasized"
            filter="blur(10px)"
            opacity="0.9"
          />
          <Text pos="relative" textStyle="md" fontWeight="medium" whiteSpace="nowrap">
            Coming Soon
          </Text>
        </Box>
      </AbsoluteCenter>
    </Box>
  );
}
