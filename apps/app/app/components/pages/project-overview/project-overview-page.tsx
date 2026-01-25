import {
  HStack,
  Stack,
  Text,
  Center,
  SimpleGrid,
  Heading,
  VStack,
  LinkOverlay,
  AspectRatio,
  Flex,
  Spinner,
  Box,
  Skeleton,
  For,
} from '@chakra-ui/react';
import { Link } from '@tanstack/react-router';
import { formatNumber } from '@vemetric/common/math';
import { motion } from 'motion/react';
import { TbPlus } from 'react-icons/tb';
import { ResponsiveContainer, AreaChart as RechartsAreaChart, XAxis, YAxis, Area, CartesianGrid } from 'recharts';
import { BaseLayout } from '~/components/base-layout';
import { CreateProjectDialog } from '~/components/create-project-dialog';
import { LoadingImage } from '~/components/loading-image';
import { Status } from '~/components/ui/status';
import { getFaviconUrl } from '~/utils/favicon';
import { trpc } from '~/utils/trpc';

const CARD_ASPECT_RATIO = 8 / 4;

interface Props {
  project: {
    id: string;
    name: string;
    domain: string;
    currentActiveUsers?: number;
    activeUserTimeSeries?: Array<{ date: string; count: number }> | null;
  };
}

const ProjectCard = (props: Props) => {
  const { project } = props;

  return (
    <Stack
      w="100%"
      gap="4"
      className="group"
      pos="relative"
      transition="all 0.2s ease-out"
      _hover={{ transform: 'scale(1.025)' }}
    >
      <AspectRatio
        ratio={CARD_ASPECT_RATIO}
        pos="relative"
        borderWidth="1px"
        borderColor="gray.emphasized"
        rounded="l3"
        overflow="hidden"
      >
        <Center w="full" h="full" bg="bg.card/70" color="fg.subtle" pos="relative">
          {project.activeUserTimeSeries === undefined ? (
            <Spinner size="xl" />
          ) : (
            <Box>
              {project.activeUserTimeSeries === null ? (
                <Text textStyle={{ base: 'sm', md: 'md' }} px={6} textAlign="center" color="fg.subtle">
                  No data available.
                </Text>
              ) : (
                <Box
                  pos="absolute"
                  inset={-1}
                  bottom={1}
                  css={{
                    '& .recharts-area-area': {
                      stroke: 'transparent!important',
                    },
                  }}
                >
                  <ResponsiveContainer>
                    <RechartsAreaChart data={project.activeUserTimeSeries} margin={{ top: 20, bottom: 10 }}>
                      <XAxis
                        dataKey="date"
                        interval="preserveStartEnd"
                        fill=""
                        stroke=""
                        tickLine={false}
                        axisLine={true}
                        minTickGap={15}
                        hide
                      />
                      <YAxis
                        yAxisId="activeUsers"
                        type="number"
                        domain={['auto', 'auto']}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                        tickFormatter={(value) => formatNumber(value, true)}
                        hide
                      />
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--chakra-colors-gray-emphasized)"
                        strokeOpacity={0.5}
                        strokeWidth={0.8}
                        strokeDasharray="10 5"
                      />
                      <defs>
                        <linearGradient
                          style={{ color: `var(--chakra-colors-blue-500)` }}
                          id={'gradient-' + project.id}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor="currentColor" stopOpacity={0.7} />
                          <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        style={{ stroke: `var(--chakra-colors-blue-500)` }}
                        strokeOpacity={1}
                        name="Active Users"
                        type="linear"
                        yAxisId="activeUsers"
                        dataKey="count"
                        stroke=""
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        isAnimationActive={true}
                        connectNulls={false}
                        fill={`url(#gradient-${project.id})`}
                      />
                    </RechartsAreaChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Box>
          )}
        </Center>
      </AspectRatio>

      <Flex align="center" justify="space-between" gap={1.5}>
        <HStack gap="2">
          <LoadingImage
            src={getFaviconUrl('https://' + project.domain, 256)}
            boxSize={[5, 7]}
            overflow="hidden"
            rounded="md"
          />
          <Text textStyle={['xs', 'sm']} fontWeight="semibold" truncate>
            <LinkOverlay asChild>
              <Link to={`/p/$projectId`} params={{ projectId: project.id }}>
                {project.name}
              </Link>
            </LinkOverlay>
          </Text>
        </HStack>

        <Status value="success" color="fg" gap={1.5}>
          <Text fontWeight="semibold">{project.currentActiveUsers}</Text>
        </Status>
      </Flex>
    </Stack>
  );
};

interface ProjectOverviewPageProps {
  organizationId: string;
}

export const ProjectOverviewPage = ({ organizationId }: ProjectOverviewPageProps) => {
  const { data: projects, isLoading: isProjectsLoading } = trpc.projects.overview.useQuery({ organizationId });

  return (
    <BaseLayout>
      <VStack flex="1" gap="7" px={4} py="12" align="flex-start">
        <Heading asChild size="2xl" textAlign="left">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            Projects
          </motion.div>
        </Heading>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{ width: '100%' }}
        >
          <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={8} w="100%">
            {isProjectsLoading ? (
              <>
                <For each={[1, 2, 3]}>
                  {(_, index) => (
                    <AspectRatio key={index} ratio={CARD_ASPECT_RATIO} pos="relative">
                      <Skeleton boxSize="100%" />
                    </AspectRatio>
                  )}
                </For>
              </>
            ) : (
              <>
                {projects?.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}

                <CreateProjectDialog organizationId={organizationId}>
                  <Stack
                    w="100%"
                    gap="4"
                    className="group"
                    pos="relative"
                    transition="all 0.2s ease-out"
                    _hover={{ transform: 'scale(1.025)' }}
                    cursor="pointer"
                  >
                    <AspectRatio
                      ratio={CARD_ASPECT_RATIO}
                      pos="relative"
                      borderWidth="2px"
                      borderStyle="dashed"
                      borderColor="gray.emphasized"
                      rounded="l3"
                      overflow="hidden"
                    >
                      <Center w="full" h="full" bg="bg.card/70" color="fg.subtle" fontSize="5xl">
                        <TbPlus />

                        <Box
                          pos="absolute"
                          right="-125px"
                          bottom="-125px"
                          w="220px"
                          h="220px"
                          border="12px solid"
                          borderColor="gray.emphasized"
                          bg="gray.emphasized/50"
                          rounded="full"
                          opacity="0.2"
                        />
                        <Box
                          pos="absolute"
                          left="-125px"
                          top="-125px"
                          w="220px"
                          h="220px"
                          border="12px solid"
                          borderColor="gray.emphasized"
                          bg="gray.emphasized/50"
                          rounded="full"
                          opacity="0.2"
                        />
                      </Center>
                    </AspectRatio>

                    <Text textStyle="sm" textAlign="center" fontWeight="semibold">
                      New Project
                    </Text>
                  </Stack>
                </CreateProjectDialog>
              </>
            )}
          </SimpleGrid>
        </motion.div>
      </VStack>
    </BaseLayout>
  );
};
