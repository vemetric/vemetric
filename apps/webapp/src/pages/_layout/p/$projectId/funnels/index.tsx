import type { FlexProps } from '@chakra-ui/react';
import { Box, Flex, Text, AbsoluteCenter, Grid } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { TbEye, TbUserSquareRounded } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { useSetBreadcrumbs } from '@/stores/header-store';

interface FunnelCardProps extends FlexProps {
  icon: React.ReactNode;
  name: string;
}

function FunnelCard({ icon, name, ...props }: FunnelCardProps) {
  return (
    <Flex
      flexDir="column"
      align="center"
      justify="center"
      w="170px"
      h="80px"
      border="1.5px solid"
      borderColor="gray.emphasized"
      rounded="md"
      bg="bg.card"
      {...props}
    >
      <Flex align="center" gap={3}>
        <CardIcon>{icon}</CardIcon>
        <Text fontWeight="semibold">{name}</Text>
      </Flex>
    </Flex>
  );
}

export const Route = createFileRoute('/_layout/p/$projectId/funnels/')({
  component: RouteComponent,
});

function RouteComponent() {
  /* TODO: 
  const { projectId } = Route.useParams();

  const { data: funnelResults } = trpc.funnels.getFunnelResults.useQuery({ projectId }); */

  useSetBreadcrumbs(['Funnels']);

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
      >
        <Box
          pos="absolute"
          inset="0"
          backgroundImage="radial-gradient(circle at 1px 1px, var(--chakra-colors-gray-emphasized) 1px, transparent 0)"
          backgroundSize="15px 15px"
          opacity={0.7}
        />
        <Flex
          pos="relative"
          gap={2}
          align="center"
          border="1.5px solid"
          borderColor="gray.emphasized"
          rounded="full"
          py={2.5}
          px={3.5}
          textStyle="sm"
          bg="bg.card"
        >
          <CardIcon>
            <TbUserSquareRounded />
          </CardIcon>
          <Text fontWeight="semibold">Active Users</Text>
        </Flex>
        <Flex pos="relative" align="center">
          <svg width="166px" height="52px" viewBox="0 2 166 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M63 0 C68 20, 30 40, 30 54 L136 54 C136 40, 98 20, 103 0"
              stroke="var(--chakra-colors-gray-emphasized)"
              strokeWidth="1.5"
              fill="var(--chakra-colors-gray-emphasized)"
            />
          </svg>
          <Box pos="relative" w="0px">
            <Text whiteSpace="nowrap" fontWeight="medium" fontSize="sm" pl={2} transform="translateX(-30px)">
              1,4k
            </Text>
          </Box>
        </Flex>
        <FunnelCard icon={<TbEye />} name="Page view" borderColor="purple.500" zIndex={1} />
        <Flex align="center" w="full" justify="center" my="-1.5px">
          <Box pos="relative">
            <svg width="380px" height="52px" viewBox="0 0 380 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M240 0 C240 20, 240 32, 220 52 L370 52 C350 32, 265 20, 265 0"
                stroke="var(--chakra-colors-gray-emphasized)"
                strokeWidth="1.5"
                fill="var(--chakra-colors-gray-emphasized)"
              />
            </svg>
            <svg
              width="380px"
              height="52px"
              viewBox="0 0 380 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ zIndex: 2, position: 'absolute', left: 0, top: 0 }}
            >
              <path
                d="M120 0 C120 20, 30 32, 10 54 L155 54 C155 32, 240 20, 240 0"
                stroke="var(--chakra-colors-purple-500)"
                strokeWidth="1.5"
                fill="var(--chakra-colors-gray-emphasized)"
              />
            </svg>
            <Grid
              gridTemplateColumns="1fr 1fr"
              pos="absolute"
              inset="0"
              alignItems="flex-end"
              zIndex="6"
              color="white"
              textAlign="center"
              fontWeight="bold"
              fontSize="sm"
            >
              <Text>80%</Text>
              <Text>20%</Text>
            </Grid>
          </Box>
        </Flex>
        <Flex gap={10}>
          <FunnelCard icon={<TbEye />} name="Page view" borderColor="purple.500" zIndex={1} />
          <FunnelCard icon={<TbEye />} name="Page view" zIndex={1} />
        </Flex>
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
