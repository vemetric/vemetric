import { Box, Button, Flex, Grid, Icon, IconButton, Skeleton, Text } from '@chakra-ui/react';
import { Link, useParams } from '@tanstack/react-router';
import { getTimespanRefetchInterval } from '@vemetric/common/charts/timespans';
import type { IFilterConfig } from '@vemetric/common/filters';
import { formatNumber, formatPercentage } from '@vemetric/common/math';
import React, { useState } from 'react';
import { TbArrowLeft, TbChartFunnel, TbChevronLeft, TbFilter, TbFilterOff, TbUsers } from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { CardBar } from '@/components/pages/dashboard/card-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { useFilters } from '@/hooks/use-filters';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { trpc } from '@/utils/trpc';
import { LIST_CARD_PAGE_SIZE, ListCard } from '../list-card';

interface Props {
  funnelId: string;
  onBack: () => void;
  activeUsers: number;
  publicDashboard?: boolean;
  filterConfig: IFilterConfig;
  activeUsersVisible?: boolean;
}

export const FunnelStepsView = ({
  funnelId,
  onBack,
  activeUsers,
  publicDashboard,
  filterConfig,
  activeUsersVisible,
}: Props) => {
  const params = useParams({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { timespan, startDate, endDate } = useTimespanParam({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const [page, setPage] = useState(1);
  const { toggleFilter } = useFilters({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const {
    data: funnelData,
    isPreviousData,
    error,
  } = trpc.dashboard.getFunnelSteps.useQuery(
    { ...params, funnelId, timespan, startDate, endDate, filterConfig },
    {
      keepPreviousData: true,
      refetchInterval: getTimespanRefetchInterval(timespan),
      onError: () => {},
    },
  );

  const { funnel, stepResults, firstStepUsers: backendFirstStepUsers } = funnelData || {};
  const baseUsers = activeUsersVisible ? activeUsers || 0 : backendFirstStepUsers || 0;
  const topStep = stepResults?.[0];

  const activeFilters = filterConfig?.filters.filter((f) => f.type === 'funnel') ?? [];

  return (
    <Box>
      <Flex align="center" mb={4} gap={2}>
        <IconButton size="2xs" variant="surface" colorScheme="gray" onClick={onBack}>
          <Icon as={TbChevronLeft} />
        </IconButton>
        <Text fontWeight="medium" whiteSpace="nowrap" truncate>
          {funnel?.name || 'Loading...'}
        </Text>
      </Flex>

      <ListCard
        list={stepResults}
        page={page}
        setPage={setPage}
        error={error}
        emptyState={
          <EmptyState icon={<TbChartFunnel />} title="No funnel steps found">
            <Button onClick={onBack} mt={4}>
              <Icon as={TbArrowLeft} />
              Back to funnels
            </Button>
          </EmptyState>
        }
      >
        <Grid gridTemplateColumns="minmax(0, 1fr) minmax(50px, auto) minmax(60px, auto)" columnGap={2} rowGap={1.5}>
          <Box mb={1} fontWeight="semibold" fontSize="sm">
            Step
          </Box>
          <Box fontWeight="semibold" textAlign="center" fontSize="sm">
            Users
          </Box>
          <Box fontWeight="semibold" textAlign="center" fontSize="sm">
            Conv.
          </Box>

          {stepResults?.slice((page - 1) * LIST_CARD_PAGE_SIZE, page * LIST_CARD_PAGE_SIZE)?.map((step, index) => {
            const actualIndex = (page - 1) * LIST_CARD_PAGE_SIZE + index;
            const conversionRate = baseUsers > 0 ? (step.users / baseUsers) * 100 : 0;

            const newFilter = {
              type: 'funnel',
              id: funnel?.id || '',
              step: actualIndex,
              operator: 'completed',
            } as const;
            const isFiltered = activeFilters.some((f) => isDeepEqual(f, newFilter));

            return (
              <React.Fragment key={actualIndex}>
                <Box className="group" pos="relative" truncate>
                  <CardBar value={step.users} maxValue={topStep?.users} />
                  <Flex align="center" px={2} py={0.5} pos="relative" gap={1.5}>
                    <Flex
                      align="center"
                      justify="center"
                      flexShrink={0}
                      boxSize="18px"
                      bg="gray.subtle"
                      rounded="4px"
                      color="gray.fg"
                      overflow="hidden"
                      fontSize="xs"
                      fontWeight="bold"
                    >
                      {actualIndex + 1}
                    </Flex>
                    <Box truncate>{funnel?.steps[actualIndex]?.name || `Step ${actualIndex + 1}`}</Box>
                  </Flex>
                  {'projectId' in params && (
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
                      <Tooltip content={`View users who completed Step ${actualIndex + 1}`}>
                        <Button asChild size="xs" p={0} minW="24px" h="24px" variant="surface" colorScheme="gray">
                          <Link
                            to="/p/$projectId/users"
                            params={{ projectId: params.projectId }}
                            search={{
                              f: {
                                filters: [newFilter],
                                operator: 'and',
                              },
                              s: {
                                by: newFilter,
                              },
                            }}
                          >
                            <Icon as={TbUsers} />
                          </Link>
                        </Button>
                      </Tooltip>
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
                        <Icon color={isFiltered ? 'purple.500' : undefined} as={isFiltered ? TbFilterOff : TbFilter} />
                      </Button>
                    </Flex>
                  )}
                </Box>
                <Box textAlign="center">
                  <Text fontSize="sm">{formatNumber(step.users)}</Text>
                </Box>
                <Box textAlign="center">
                  <Text fontSize="sm">{formatPercentage(conversionRate)}</Text>
                </Box>
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
    </Box>
  );
};
