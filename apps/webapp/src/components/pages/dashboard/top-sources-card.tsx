import { Box, Text, Card, Flex, Grid, Icon, Button, Skeleton, Link as ChakraLink } from '@chakra-ui/react';
import { useSearch, useParams, useNavigate, Link } from '@tanstack/react-router';
import { getTimespanRefetchInterval } from '@vemetric/common/charts/timespans';
import type { IFilter, IFilterConfig } from '@vemetric/common/filters';
import { formatNumber } from '@vemetric/common/math';
import { getSourceValue, SOURCE_VALUES } from '@vemetric/common/sources';
import React, { useMemo, useState } from 'react';
import { TbDirectionSign, TbExternalLink, TbFilter, TbFilterOff, TbUsers } from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { CardIcon } from '@/components/card-icon';
import { NumberCounter } from '@/components/number-counter';
import { SegmentedMenu } from '@/components/segmented-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { useFilters } from '@/hooks/use-filters';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { trpc } from '@/utils/trpc';
import { CardBar } from './card-bar';
import { DashboardCardHeader } from './dashboard-card-header';
import { LIST_CARD_PAGE_SIZE, ListCard } from './list-card';
import { ReferrerIcon } from '../../referrer-icon';

interface Props {
  filterConfig: IFilterConfig;
  publicDashboard?: boolean;
}

export const TopSourcesCard = ({ filterConfig, publicDashboard }: Props) => {
  const params = useParams({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { timespan, startDate, endDate } = useTimespanParam({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const { s: sourceType = 'referrer' } = useSearch({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const navigate = useNavigate({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });
  const { toggleFilter } = useFilters({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const activeFilters =
    filterConfig?.filters.filter(
      (f) => f.type === 'referrer' || f.type === 'referrerUrl' || f.type === 'referrerType' || f.type === 'utmTags',
    ) ?? [];

  const sourceValue = useMemo(() => getSourceValue(sourceType), [sourceType]);

  const { data, isPreviousData, error } = trpc.dashboard.getTopSources.useQuery(
    {
      ...params,
      timespan,
      startDate,
      endDate,
      filterConfig,
      source: sourceValue.segment === 'referrer' ? sourceValue.referrer : sourceValue.utm,
    },
    {
      keepPreviousData: true,
      refetchInterval: getTimespanRefetchInterval(timespan),
    },
  );
  const topSources = data?.data;
  const dataSource = data?.dataSource ?? 'referrer';
  const mostVisitedSource = topSources?.[0];

  const [page, setPage] = useState(1);

  const label =
    sourceValue.segment === 'referrer'
      ? SOURCE_VALUES.referrer[sourceValue.referrer]
      : SOURCE_VALUES.utm[sourceValue.utm];

  return (
    <Card.Root>
      <DashboardCardHeader>
        <Flex align="center" w="100%" flexWrap="wrap" gap={2}>
          <Flex flexDir="column" gap={1}>
            <Flex align="center" gap={1.5}>
              <CardIcon size="xs">
                <TbDirectionSign />
              </CardIcon>
              <Text>Top Sources</Text>
            </Flex>
            <Text textStyle="sm" fontWeight="normal" color="fg.muted" pl={0.5}>
              from <NumberCounter value={topSources?.length ?? 0} />{' '}
              <>
                {label}
                {topSources?.length !== 1 ? 's' : ''}
              </>
            </Text>
          </Flex>
          <Flex flexGrow={1} justify="flex-end">
            <SegmentedMenu
              size="xs"
              values={SOURCE_VALUES}
              value={sourceValue}
              onChange={(value) => {
                navigate({
                  resetScroll: false,
                  search: (prev) => {
                    const newValue = value.segment === 'referrer' ? value.referrer : value.utm;

                    return {
                      ...prev,
                      s: newValue === 'referrer' ? undefined : newValue,
                    };
                  },
                });
              }}
            />
          </Flex>
        </Flex>
      </DashboardCardHeader>
      <Card.Body>
        <ListCard
          list={topSources}
          page={page}
          setPage={setPage}
          error={error}
          emptyState={<EmptyState icon={<TbDirectionSign />} title="No data in the selected timeframe" />}
        >
          <Grid gridTemplateColumns="minmax(0, 1fr) minmax(50px, auto)" columnGap={2} rowGap={1.5}>
            <Box mb={1} fontWeight="semibold" fontSize="sm">
              {label}
            </Box>
            <Box fontWeight="semibold" textAlign="center" fontSize="sm">
              Users
            </Box>
            {topSources?.slice((page - 1) * LIST_CARD_PAGE_SIZE, page * LIST_CARD_PAGE_SIZE)?.map((topSource) => {
              const isDirect = topSource[sourceValue.referrer] === '';

              let newFilter: IFilter | undefined;
              switch (sourceType) {
                case 'referrer':
                  newFilter = {
                    type: 'referrer',
                    referrerFilter: { operator: 'is', value: topSource[sourceType] },
                  };
                  break;
                case 'referrerUrl':
                  newFilter = {
                    type: 'referrerUrl',
                    referrerUrlFilter: { operator: 'is', value: topSource[sourceType] },
                  };
                  break;
                case 'referrerType':
                  newFilter = {
                    type: 'referrerType',
                    referrerTypeFilter: { operator: 'oneOf', value: [topSource[sourceType] ?? 'direct'] },
                  };
                  break;
                case 'utmCampaign':
                  newFilter = {
                    type: 'utmTags',
                    utmCampaignFilter: { operator: 'is', value: topSource[sourceType] },
                  };
                  break;
                case 'utmContent':
                  newFilter = {
                    type: 'utmTags',
                    utmContentFilter: { operator: 'is', value: topSource[sourceType] },
                  };
                  break;
                case 'utmMedium':
                  newFilter = {
                    type: 'utmTags',
                    utmMediumFilter: { operator: 'is', value: topSource[sourceType] },
                  };
                  break;
                case 'utmSource':
                  newFilter = {
                    type: 'utmTags',
                    utmSourceFilter: { operator: 'is', value: topSource[sourceType] },
                  };
                  break;
                case 'utmTerm':
                  newFilter = {
                    type: 'utmTags',
                    utmTermFilter: { operator: 'is', value: topSource[sourceType] },
                  };
                  break;
              }

              const isFiltered = activeFilters.some((f) => isDeepEqual(f, newFilter));

              return (
                <React.Fragment key={dataSource + topSource[dataSource ?? 'referrer']}>
                  <Flex align="center" pos="relative" truncate className="group" minH="28px">
                    <CardBar value={topSource.users} maxValue={mostVisitedSource?.users} />
                    {sourceValue.segment === 'referrer' ? (
                      <Flex align="center" px={2} py={0.5} pos="relative" gap={2}>
                        <Flex
                          align="center"
                          justify="center"
                          flexShrink={0}
                          boxSize="18px"
                          bg="gray.subtle"
                          rounded="4px"
                          color="gray.fg"
                          overflow="hidden"
                          filter="grayscale(0.3)"
                        >
                          <ReferrerIcon source={dataSource} {...topSource} />
                        </Flex>
                        {sourceValue.referrer === 'referrerType' ? (
                          <Box>{topSource.referrerType}</Box>
                        ) : (
                          <Flex align="center" gap={1.5}>
                            {isDirect ? 'Direct / None' : topSource[sourceValue.referrer]}{' '}
                          </Flex>
                        )}
                      </Flex>
                    ) : (
                      <Flex px={2} py={0.5} pos="relative">
                        {topSource[sourceValue.utm]}
                      </Flex>
                    )}

                    <Flex
                      zIndex="1"
                      pos="absolute"
                      inset="0"
                      alignItems="center"
                      justify="flex-end"
                      transition="all 0.2s ease-in-out"
                      bg="linear-gradient(to right, rgba(0, 0, 0, 0) 60%, var(--chakra-colors-bg-card) 95%)"
                      opacity="0"
                      _groupHover={{ opacity: '1' }}
                      gap="2"
                    >
                      {'projectId' in params && (
                        <Tooltip content="View users that have come from this source">
                          <Button asChild size="xs" p={0} minW="24px" h="24px" variant="surface" colorScheme="gray">
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
                      {topSource.referrerUrl && (
                        <Button asChild size="xs" variant="surface" colorScheme="gray" p={0} minW="24px" h="24px">
                          <ChakraLink
                            href={topSource.referrerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            outline="none"
                          >
                            <TbExternalLink />
                          </ChakraLink>
                        </Button>
                      )}
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
                  </Flex>
                  <Box textAlign="center">{formatNumber(topSource.users)}</Box>
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
      </Card.Body>
    </Card.Root>
  );
};
