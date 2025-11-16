import { Button, Box, Skeleton, Grid, Icon, Flex, Card, Text } from '@chakra-ui/react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { getTimespanRefetchInterval } from '@vemetric/common/charts/timespans';
import type { IFilterConfig } from '@vemetric/common/filters';
import { formatNumber, formatPercentage } from '@vemetric/common/math';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import { TbChartFunnel, TbEye, TbFilter, TbFilterOff, TbUserSquareRounded, TbUsers } from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { CardIcon } from '@/components/card-icon';
import { FunnelIconButton } from '@/components/funnel-icon-button';
import { NumberCounter } from '@/components/number-counter';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { useFilters } from '@/hooks/use-filters';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { trpc } from '@/utils/trpc';
import { CardBar } from '../card-bar';
import { DashboardCardHeader } from '../dashboard-card-header';
import { LIST_CARD_PAGE_SIZE, ListCard } from '../list-card';
import { FunnelStepsView } from './funnel-steps-view';

const getMotionViewProps = (toLeft?: boolean) => ({
  initial: { x: toLeft ? '-100%' : '100%' },
  animate: { x: 0, transition: { duration: 0.2, bounce: 0 } },
  exit: { x: toLeft ? '-100%' : '100%', transition: { duration: 0.2, bounce: 0 } },
});

interface Props {
  filterConfig: IFilterConfig;
  publicDashboard?: boolean;
  activeUsers: number;
}

export const FunnelsCard = ({ filterConfig, publicDashboard, activeUsers }: Props) => {
  const params = useParams({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { timespan, startDate, endDate } = useTimespanParam({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const { sf: selectedFunnel, fu: activeUsersVisible } = useSearch({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const [page, setPage] = useState(1);
  const { toggleFilter } = useFilters({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });
  const navigate = useNavigate({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const [isAnimating, setIsAnimating] = useState(false);

  const selectFunnel = (funnelId: string | null) => {
    setIsAnimating(true);
    setTimeout(() => {
      navigate({
        search: (prev) => ({ ...prev, sf: funnelId ?? undefined }),
        resetScroll: false,
      });
      setTimeout(() => setIsAnimating(false), 300);
    }, 1);
  };

  const activeFilters = filterConfig?.filters.filter((f) => f.type === 'funnel') ?? [];

  const { data, isPreviousData, error } = trpc.dashboard.getFunnels.useQuery(
    { ...params, timespan, startDate, endDate, filterConfig },
    {
      keepPreviousData: true,
      onError: () => {},
      refetchInterval: getTimespanRefetchInterval(timespan),
    },
  );

  const getTopConversionRate = () => {
    if (!data?.funnels?.length) return 0;
    return Math.max(
      ...data.funnels.map((funnel) => {
        const baseUsers = (activeUsersVisible ? activeUsers : funnel.firstStepUsers) || 0;
        const completedUsers = funnel.completedUsers || 0;
        return baseUsers > 0 ? (completedUsers / baseUsers) * 100 : 0;
      }),
    );
  };

  return (
    <Card.Root>
      <DashboardCardHeader>
        <Flex align="center" justify="space-between" gap={3} w="100%">
          <Flex flexDir="column" gap={1}>
            <Flex align="center" gap={1.5}>
              <CardIcon size="xs">
                <TbChartFunnel />
              </CardIcon>
              <Text>Funnels</Text>
            </Flex>
            <Text textStyle="sm" fontWeight="normal" color="fg.muted" pl={0.5}>
              <NumberCounter value={data?.funnels.length ?? 0} /> funnel{data?.funnels.length !== 1 ? 's' : ''} tracked
            </Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Tooltip
              content={
                <Flex flexDir="column" gap={1}>
                  <Text>
                    Toggle to calculate conversion rates from all users vs from users that have entered the funnel
                  </Text>
                </Flex>
              }
              positioning={{ placement: 'bottom' }}
            >
              <Button
                size="2xs"
                variant="surface"
                p={0}
                colorPalette={activeUsersVisible ? 'purple' : 'gray'}
                rounded="sm"
                onClick={() =>
                  navigate({
                    search: (prev) => ({ ...prev, fu: !activeUsersVisible || undefined }),
                    resetScroll: false,
                  })
                }
              >
                <TbUserSquareRounded />
              </Button>
            </Tooltip>
            {'projectId' in params && (
              <Button asChild size="2xs" variant="surface" colorScheme="gray" rounded="sm">
                {selectedFunnel === undefined ? (
                  <Link to="/p/$projectId/funnels" params={{ projectId: params.projectId }}>
                    <TbChartFunnel />
                    View All
                  </Link>
                ) : (
                  <Link
                    to="/p/$projectId/funnels/$funnelId"
                    params={{ projectId: params.projectId, funnelId: selectedFunnel }}
                  >
                    <TbChartFunnel />
                    View Funnel
                  </Link>
                )}
              </Button>
            )}
          </Flex>
        </Flex>
      </DashboardCardHeader>
      <Card.Body pos="relative" overflow={isAnimating ? 'hidden' : 'visible'}>
        <AnimatePresence initial={false} mode="popLayout">
          {selectedFunnel === undefined ? (
            <motion.div key="list" {...getMotionViewProps(true)}>
              <ListCard
                list={data?.funnels}
                page={page}
                setPage={setPage}
                error={error}
                emptyState={
                  <EmptyState
                    icon={<TbChartFunnel />}
                    title="No funnels available"
                    description="Create your first funnel to start tracking conversions."
                  >
                    {'projectId' in params && (
                      <Button asChild mt={4}>
                        <Link to="/p/$projectId/funnels" params={{ projectId: params.projectId }}>
                          Create your first funnel
                        </Link>
                      </Button>
                    )}
                  </EmptyState>
                }
              >
                <Grid
                  gridTemplateColumns="minmax(0, 1fr) minmax(50px, auto) minmax(60px, auto)"
                  columnGap={2}
                  rowGap={1.5}
                >
                  <Box mb={1} fontWeight="semibold" fontSize="sm">
                    Name
                  </Box>
                  <Box fontWeight="semibold" textAlign="center" fontSize="sm">
                    Users
                  </Box>
                  <Box fontWeight="semibold" textAlign="center" fontSize="sm">
                    Conv.
                  </Box>
                  {data?.funnels?.slice((page - 1) * LIST_CARD_PAGE_SIZE, page * LIST_CARD_PAGE_SIZE)?.map((funnel) => {
                    const baseUsers = (activeUsersVisible ? activeUsers : funnel.firstStepUsers) || 0;
                    const completedUsers = funnel.completedUsers || 0;
                    const conversionRate = baseUsers > 0 ? (completedUsers / baseUsers) * 100 : 0;
                    const newFilter = {
                      type: 'funnel',
                      id: funnel.id,
                      step: funnel.steps.length - 1,
                      operator: 'completed',
                    } as const;
                    const isFiltered = activeFilters.some((f) => isDeepEqual(f, newFilter));

                    return (
                      <React.Fragment key={funnel.id}>
                        <Box className="group" pos="relative" truncate>
                          <CardBar value={conversionRate} maxValue={getTopConversionRate()} />
                          <Flex align="center" px={2} py={0.5} pos="relative" gap={1.5}>
                            <FunnelIconButton icon={funnel.icon} readOnly size="xs" />
                            <Box truncate>{funnel.name}</Box>
                          </Flex>
                          <Flex
                            zIndex="1"
                            pos="absolute"
                            inset="0"
                            alignItems="center"
                            justify="flex-end"
                            transition="all 0.2s ease-in-out"
                            bg="linear-gradient(to right, rgba(0, 0, 0, 0) 30%, var(--chakra-colors-bg-card) 85%)"
                            opacity="0"
                            gap="2"
                            _groupHover={{ opacity: '1' }}
                          >
                            {'projectId' in params && (
                              <Tooltip content="View users who completed this funnel">
                                <Button
                                  asChild
                                  size="xs"
                                  p={0}
                                  minW="24px"
                                  h="24px"
                                  variant="surface"
                                  colorScheme="gray"
                                >
                                  <Link
                                    to="/p/$projectId/users"
                                    params={{ projectId: params.projectId }}
                                    search={{
                                      f: { filters: [newFilter], operator: 'and' },
                                      s: { by: newFilter },
                                    }}
                                  >
                                    <Icon as={TbUsers} />
                                  </Link>
                                </Button>
                              </Tooltip>
                            )}
                            <Button
                              size="xs"
                              p={0}
                              minW="24px"
                              h="24px"
                              variant="surface"
                              colorScheme="gray"
                              onClick={() => {
                                selectFunnel(funnel.id);
                              }}
                            >
                              <Icon as={TbEye} />
                            </Button>
                            <Button
                              size="xs"
                              p={0}
                              mr="1px"
                              minW="24px"
                              h="24px"
                              variant="surface"
                              colorScheme="gray"
                              onClick={() => {
                                toggleFilter(newFilter);
                              }}
                            >
                              <Icon
                                color={isFiltered ? 'purple.500' : undefined}
                                as={isFiltered ? TbFilterOff : TbFilter}
                              />
                            </Button>
                          </Flex>
                        </Box>
                        <Box textAlign="center">{formatNumber(completedUsers)}</Box>
                        <Box textAlign="center">{formatPercentage(conversionRate)}</Box>
                      </React.Fragment>
                    );
                  })}
                </Grid>
              </ListCard>
              {isPreviousData && (
                <Box pos="absolute" inset="0" opacity="0.8" zIndex="docked">
                  <Skeleton pos="absolute" inset="0" rounded="md" />
                </Box>
              )}
            </motion.div>
          ) : (
            <motion.div key="funnel" {...getMotionViewProps(false)}>
              <FunnelStepsView
                publicDashboard={publicDashboard}
                activeUsers={activeUsers}
                funnelId={selectedFunnel}
                filterConfig={filterConfig}
                activeUsersVisible={activeUsersVisible}
                onBack={() => selectFunnel(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Card.Body>
    </Card.Root>
  );
};
