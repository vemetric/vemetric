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
  Button,
} from '@chakra-ui/react';
import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { TbWorldPlus } from 'react-icons/tb';
import { BaseLayout } from '@/components/base-layout';
import { CreateProjectDialog } from '@/components/create-project-dialog';
import { LoadingImage } from '@/components/loading-image';
import { Status } from '@/components/ui/status';
import { getFaviconUrl } from '@/utils/favicon';
import { trpc } from '@/utils/trpc';
import { ActiveUsersSparkline } from './active-users-sparkline';

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
                <Box pos="absolute" inset={-1} bottom={1} color="blue.500">
                  <ActiveUsersSparkline data={project.activeUserTimeSeries} />
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
        <Flex align="center" justify="space-between" w="100%">
          <Heading asChild size="2xl" textAlign="left">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              Projects
            </motion.div>
          </Heading>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.4 }}>
            <CreateProjectDialog organizationId={organizationId}>
              <Button size="xs" variant="surface">
                <TbWorldPlus />
                New Project
              </Button>
            </CreateProjectDialog>
          </motion.div>
        </Flex>
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
                      <Center w="full" h="full" bg="bg.card/70" color="fg.subtle" fontSize={{ base: '4xl', md: '5xl' }}>
                        <TbWorldPlus />

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
