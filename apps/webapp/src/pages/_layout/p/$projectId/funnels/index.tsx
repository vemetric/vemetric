import { AspectRatio, Box, Button, Card, Flex, Icon, Grid, SimpleGrid, Text } from '@chakra-ui/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { TIME_SPANS } from '@vemetric/common/charts/timespans';
import { formatPercentage } from '@vemetric/common/math';
import { TbChartFunnel, TbPlus } from 'react-icons/tb';
import { z } from 'zod';
import { PageDotBackground } from '@/components/page-dot-background';
import { TimespanSelect } from '@/components/timespan-select';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { useSetBreadcrumbs } from '@/stores/header-store';

const searchSchema = z.object({
  t: z.enum(TIME_SPANS).optional(),
});

export const Route = createFileRoute('/_layout/p/$projectId/funnels/')({
  validateSearch: zodValidator(searchSchema),
  component: RouteComponent,
});

type FunnelStep = {
  users: number;
};

const funnels: Array<FunnelStep[]> = [
  [{ users: 1001 }, { users: 750 }, { users: 400 }, { users: 250 }, { users: 240 }],
  [{ users: 2001 }, { users: 1050 }, { users: 500 }, { users: 350 }, { users: 350 }, { users: 100 }],
  [{ users: 2001 }, { users: 1050 }, { users: 500 }, { users: 150 }],
  [{ users: 2001 }, { users: 1050 }, { users: 500 }],
];

function RouteComponent() {
  const { projectId } = Route.useParams();

  useSetBreadcrumbs(['Funnels']);

  return (
    <>
      <PageDotBackground />
      <Box pos="relative" maxW="100%">
        <Flex pos="relative" mb={6} align="center" gap={2} justify="space-between" zIndex="1">
          <Button variant="surface" size="sm">
            <Icon as={TbPlus} />
            New funnel
          </Button>
          <TimespanSelect from="/_layout/p/$projectId/funnels/" />
        </Flex>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5}>
          {funnels.map((funnelSteps, index) => {
            const firstStepUsers = funnelSteps[1].users;
            const completedPercentage = (funnelSteps[funnelSteps.length - 1].users / funnelSteps[0].users) * 100;

            return (
              <Link key={index} to="/p/$projectId/funnels/$funnelId" params={{ projectId, funnelId: index.toString() }}>
                <Card.Root
                  overflow="hidden"
                  rounded="xl"
                  transition="all 0.2s ease-in-out"
                  _hover={{ bg: 'gray.subtle/50', borderColor: 'purple.500/50' }}
                >
                  <Card.Header py={1.5} borderBottom="1px solid" borderColor="gray.emphasized/50">
                    <Flex justify="space-between" align="center">
                      <Text fontSize="sm" fontWeight="semibold">
                        Funnel {index + 1}
                      </Text>
                      <Tooltip content={`${formatPercentage(completedPercentage)} of users completed this funnel`}>
                        <Text fontSize="xs" fontWeight="semibold" opacity="0.8">
                          {formatPercentage(completedPercentage)}
                        </Text>
                      </Tooltip>
                    </Flex>
                  </Card.Header>
                  <Card.Body p={0} pt={2.5}>
                    <AspectRatio ratio={16 / 9}>
                      <Flex h="100%" justify="flex-start!important" align="flex-end!important">
                        <Grid
                          templateColumns={`repeat(${funnelSteps.length - 1}, 80px)`}
                          alignItems="flex-end"
                          h="90%"
                          px={4}
                        >
                          {funnelSteps.slice(1).map((step, index) => {
                            const isFirstStep = index === 0;
                            const isLastStep = index === funnelSteps.length - 2;

                            const barPercentage = (step.users / firstStepUsers) * 100;
                            const nextBarPercentage = isLastStep
                              ? 0
                              : (funnelSteps[index + 2].users / firstStepUsers) * 100;

                            const sameHeight = Math.abs(barPercentage - nextBarPercentage) < 5;
                            const startY = 100 - barPercentage;
                            const endY = 100 - nextBarPercentage;
                            const previousUsers = funnelSteps[index].users;

                            const lostUsers = previousUsers - step.users;
                            const lostUsersPercentage = (lostUsers / previousUsers) * 100 || 0;
                            const completedPercentage = (step.users / previousUsers) * 100 || 0;

                            return (
                              <Flex pos="relative" h="100%" w="100%" key={index} align="flex-end">
                                {!isLastStep && (
                                  <Box pos="absolute" h="100%" w="50%" right="-6%" opacity={{ base: 0.15, _dark: 0.2 }}>
                                    <svg
                                      width="100%"
                                      height="100%"
                                      viewBox="0 0 50 100"
                                      preserveAspectRatio="none"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d={
                                          sameHeight
                                            ? `M0 ${startY + 1.5} L50 ${endY + 1} L50 104 L0 104 Z`
                                            : `M0 ${startY + 2} C10 ${startY + 2}, 30 ${endY}, 50 ${
                                                endY + 1
                                              } L50 104 L0 104 Z`
                                        }
                                        strokeWidth="2"
                                        stroke="var(--chakra-colors-purple-500)"
                                        fill="var(--chakra-colors-purple-500)"
                                      />
                                    </svg>
                                  </Box>
                                )}
                                <Box
                                  pos="relative"
                                  h={`${barPercentage}%`}
                                  w="60%"
                                  borderTopRadius="lg"
                                  bg="linear-gradient(to top, rgb(59 130 246 / 50%), rgb(59 130 246 / 30%)), var(--chakra-colors-bg-card)"
                                  border="1px solid"
                                  borderColor="purple.400/60"
                                  borderBottom="none"
                                >
                                  <Box
                                    pos="absolute"
                                    top="-16px"
                                    right="-1px"
                                    fontSize="2xs"
                                    fontWeight="semibold"
                                    color={isFirstStep ? 'green.600' : 'red.600'}
                                    textAlign="center"
                                    w="100%"
                                  >
                                    {formatPercentage(isFirstStep ? completedPercentage : -lostUsersPercentage)}
                                  </Box>
                                </Box>
                              </Flex>
                            );
                          })}
                        </Grid>
                      </Flex>
                    </AspectRatio>
                  </Card.Body>
                </Card.Root>
              </Link>
            );
          })}
          <Card.Root
            as="button"
            overflow="hidden"
            rounded="xl"
            borderStyle="dashed"
            borderWidth="2px"
            transition="all 0.2s ease-in-out"
            _hover={{ bg: 'gray.subtle/50', borderColor: 'purple.500/50' }}
          >
            <Card.Body>
              <Flex justify="center" align="center" h="100%">
                <EmptyState icon={<TbChartFunnel />} title="Create a new funnel" />
              </Flex>
            </Card.Body>
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
          </Card.Root>
        </SimpleGrid>
      </Box>
    </>
  );
}
