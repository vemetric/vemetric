import { Text, Card, Flex, Box, Button, Grid, Icon, Skeleton, SegmentGroup } from '@chakra-ui/react';
import { useParams, Link } from '@tanstack/react-router';
import { getTimespanRefetchInterval } from '@vemetric/common/charts/timespans';
import { COUNTRIES } from '@vemetric/common/countries';
import type { IFilterConfig, ILocationFilter } from '@vemetric/common/filters';
import { formatNumber } from '@vemetric/common/math';
import React, { useState, useRef, useEffect } from 'react';
import { TbFilter, TbFilterOff, TbMap2, TbUsers, TbList, TbWorld } from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { CardIcon } from '@/components/card-icon';
import { CountryFlag } from '@/components/country-flag';
import { NumberCounter } from '@/components/number-counter';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { useFilters } from '@/hooks/use-filters';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { trpc } from '@/utils/trpc';
import { CardBar } from './card-bar';
import { CountriesWorldMap } from './countries-world-map';
import { DashboardCardHeader } from './dashboard-card-header';
import { LIST_CARD_PAGE_SIZE, ListCard } from './list-card';

interface Props {
  filterConfig: IFilterConfig;
  publicDashboard?: boolean;
}

export const CountriesCard = ({ filterConfig, publicDashboard }: Props) => {
  const params = useParams({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { timespan, startDate, endDate } = useTimespanParam({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const { toggleFilter } = useFilters({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const activeFilters = filterConfig?.filters.filter((f) => f.type === 'location') ?? [];

  const { data, isPreviousData, error } = trpc.dashboard.getCountries.useQuery(
    { ...params, timespan, startDate, endDate, filterConfig },
    {
      keepPreviousData: true,
      onError: () => {},
      refetchInterval: getTimespanRefetchInterval(timespan),
    },
  );

  const mostVisitedLocation = data?.countryCodes?.[0];
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Ref to measure list container height
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number>(350); // Default height

  // Measure list height when it renders or changes
  useEffect(() => {
    if (listContainerRef.current && viewMode === 'list') {
      // Use setTimeout to ensure the DOM has fully rendered with flexbox calculations
      const timer = setTimeout(() => {
        if (listContainerRef.current) {
          const height = listContainerRef.current.offsetHeight;
          if (height > 0) {
            setListHeight(height);
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [viewMode, data?.countryCodes, page]);

  const handleCountryClick = (countryCode: string) => {
    const newFilter = {
      type: 'location',
      countryFilter: { operator: 'oneOf', value: [countryCode] },
    } as ILocationFilter;
    toggleFilter(newFilter);
  };

  return (
    <Card.Root>
      <DashboardCardHeader>
        <Flex align="center" w="100%" flexWrap="wrap" gap={2}>
          <Flex flexDir="column" gap={1}>
            <Flex align="center" gap={1.5}>
              <CardIcon size="xs">
                <TbMap2 />
              </CardIcon>
              <Text>Countries</Text>
            </Flex>
            <Text textStyle="sm" fontWeight="normal" color="fg.muted" pl={0.5}>
              <NumberCounter value={data?.countryCodes.length ?? 0} /> countr
              {data?.countryCodes.length === 1 ? 'y' : 'ies'}
            </Text>
          </Flex>
          <Flex flexGrow={1} justify="flex-end">
            <SegmentGroup.Root
              size="xs"
              value={viewMode}
              onValueChange={({ value }) => {
                setViewMode(value as 'list' | 'map');
              }}
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Item value="list">
                <SegmentGroup.ItemText>
                  <Flex align="center" gap={1}>
                    <Icon as={TbList} />
                    <Box hideBelow="md">List</Box>
                  </Flex>
                </SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
              <SegmentGroup.Item value="map">
                <SegmentGroup.ItemText>
                  <Flex align="center" gap={1}>
                    <Icon as={TbWorld} />
                    <Box hideBelow="md">Map</Box>
                  </Flex>
                </SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
            </SegmentGroup.Root>
          </Flex>
        </Flex>
      </DashboardCardHeader>
      <Card.Body overflow="hidden" transition="height 0.3s ease-in-out" display="flex" flexDir="column">
        {viewMode === 'map' ? (
          <Box h={`${listHeight}px`} overflow="hidden" flexShrink={0}>
            {data?.countryCodes && data.countryCodes.length > 0 ? (
              <CountriesWorldMap data={data.countryCodes} onCountryClick={handleCountryClick} />
            ) : (
              <EmptyState icon={<TbMap2 />} title="No countries available in the selected timeframe" />
            )}
          </Box>
        ) : (
          <Box ref={listContainerRef} display="flex" flexDir="column" flexGrow={1}>
            <ListCard
              list={data?.countryCodes}
              page={page}
              setPage={setPage}
              error={error}
              emptyState={<EmptyState icon={<TbMap2 />} title="No countries available in the selected timeframe" />}
            >
              <Grid gridTemplateColumns="minmax(0, 1fr) minmax(50px, auto)" columnGap={2} rowGap={1.5}>
                <Box mb={1} fontWeight="semibold" fontSize="sm">
                  Country
                </Box>
                <Box fontWeight="semibold" textAlign="center" fontSize="sm">
                  Users
                </Box>
                {data?.countryCodes
                  ?.slice((page - 1) * LIST_CARD_PAGE_SIZE, page * LIST_CARD_PAGE_SIZE)
                  ?.map(({ countryCode, users }) => {
                    const newFilter = {
                      type: 'location',
                      countryFilter: { operator: 'oneOf', value: [countryCode] },
                    } as ILocationFilter;
                    const isFiltered = activeFilters.some((f) => isDeepEqual(f, newFilter));

                    return (
                      <React.Fragment key={countryCode}>
                        <Box className="group" pos="relative" truncate>
                          <CardBar value={users} maxValue={mostVisitedLocation?.users} />
                          <Flex px={2} py={0.5} pos="relative" gap={1.5} align="center">
                            <CountryFlag countryCode={countryCode} />
                            {COUNTRIES[countryCode as keyof typeof COUNTRIES] ?? 'Unknown'}
                          </Flex>
                          <Flex
                            zIndex="1"
                            pos="absolute"
                            inset="0"
                            alignItems="center"
                            justify="flex-end"
                            transition="all 0.2s ease-in-out"
                            bg="linear-gradient(to right, rgba(0, 0, 0, 0) 60%, var(--chakra-colors-bg-card) 95%)"
                            opacity="0"
                            gap="2"
                            _groupHover={{ opacity: '1' }}
                          >
                            {'projectId' in params && (
                              <Tooltip content="View users that are from this country">
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
                              mr="1px"
                              minW="24px"
                              h="24px"
                              variant="surface"
                              colorScheme="gray"
                              onClick={() => toggleFilter(newFilter)}
                            >
                              <Icon
                                color={isFiltered ? 'purple.500' : undefined}
                                as={isFiltered ? TbFilterOff : TbFilter}
                              />
                            </Button>
                          </Flex>
                        </Box>
                        <Box textAlign="center">{formatNumber(users)}</Box>
                      </React.Fragment>
                    );
                  })}
              </Grid>
            </ListCard>
          </Box>
        )}
        {isPreviousData && (
          <Box pos="absolute" inset="0" opacity="0.8" zIndex="docked">
            <Skeleton pos="absolute" inset="0" rounded="md" />
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  );
};
