import { Text, Card, Flex, Box, Button, Grid, Icon, Skeleton } from '@chakra-ui/react';
import { useSearch, useParams } from '@tanstack/react-router';
import type { IBrowserFilter, IFilterConfig } from '@vemetric/common/filters';
import { formatNumber } from '@vemetric/common/math';
import React, { useState } from 'react';
import { TbUserSquareRounded, TbFilter, TbFilterOff, TbMap2 } from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { BrowserIcon } from '@/components/browser-icon';
import { CardIcon } from '@/components/card-icon';
import { NumberCounter } from '@/components/number-counter';
import { EmptyState } from '@/components/ui/empty-state';
import { useFilters } from '@/hooks/use-filters';
import { trpc } from '@/utils/trpc';
import { CardBar } from './card-bar';
import { DashboardCardHeader } from './dashboard-card-header';
import { LIST_CARD_PAGE_SIZE, ListCard } from './list-card';
import { UserCardSelect } from './user-card-select';

interface Props {
  filterConfig: IFilterConfig;
  publicDashboard?: boolean;
}

export const BrowsersCard = ({ filterConfig, publicDashboard }: Props) => {
  const params = useParams({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { t: timespan } = useSearch({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { toggleFilter } = useFilters({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const activeFilters = filterConfig?.filters.filter((f) => f.type === 'browser') ?? [];

  const { data, isPreviousData, error } = trpc.dashboard.getBrowsers.useQuery(
    { ...params, timespan, filterConfig },
    { keepPreviousData: true, onError: () => {} },
  );
  const mostUsedBrowser = data?.browsers?.[0];

  const [page, setPage] = useState(1);

  return (
    <Card.Root>
      <DashboardCardHeader>
        <Flex align="center" w="100%" flexWrap="wrap" gap={2}>
          <Flex flexDir="column" gap={1}>
            <Flex align="center" gap={1.5}>
              <CardIcon size="xs">
                <TbUserSquareRounded />
              </CardIcon>
              <Text>Users</Text>
            </Flex>
            <Text textStyle="sm" fontWeight="normal" color="fg.muted" pl={0.5}>
              <NumberCounter value={data?.browsers.length ?? 0} /> browser
              {data?.browsers.length !== 1 && 's'}
            </Text>
          </Flex>
          <Flex flexGrow={1} justify="flex-end">
            <UserCardSelect publicDashboard={publicDashboard} />
          </Flex>
        </Flex>
      </DashboardCardHeader>
      <Card.Body>
        <ListCard
          list={data?.browsers}
          page={page}
          setPage={setPage}
          error={error}
          emptyState={<EmptyState icon={<TbMap2 />} title="No browsers available in the selected timeframe" />}
        >
          <Grid gridTemplateColumns="minmax(0, 1fr) minmax(50px, auto)" columnGap={2} rowGap={1.5}>
            <Box mb={1} fontWeight="semibold" fontSize="sm">
              Browser
            </Box>
            <Box fontWeight="semibold" textAlign="center" fontSize="sm">
              Users
            </Box>
            {data?.browsers
              ?.slice((page - 1) * LIST_CARD_PAGE_SIZE, page * LIST_CARD_PAGE_SIZE)
              ?.map(({ browserName, users }) => {
                const newFilter = {
                  type: 'browser',
                  browserFilter: { operator: 'oneOf', value: [browserName] },
                } as IBrowserFilter;
                const isFiltered = activeFilters.some((f) => isDeepEqual(f, newFilter));

                return (
                  <React.Fragment key={browserName}>
                    <Box className="group" pos="relative" truncate>
                      <CardBar value={users} maxValue={mostUsedBrowser?.users} />
                      <Flex px={2} py={0.5} pos="relative" gap={1.5} align="center">
                        <BrowserIcon browserName={browserName} />
                        <Text>{browserName}</Text>
                      </Flex>

                      <Flex
                        zIndex="1"
                        pos="absolute"
                        inset="0"
                        alignItems="center"
                        justify="flex-end"
                        cursor="pointer"
                        onClick={() => toggleFilter(newFilter)}
                        transition="all 0.2s ease-in-out"
                        bg="linear-gradient(to right, rgba(0, 0, 0, 0) 60%, var(--chakra-colors-bg-card) 95%)"
                        opacity="0"
                        _groupHover={{ opacity: '1' }}
                      >
                        <Button size="xs" p={0} mr="1px" minW="24px" h="24px" variant="surface" colorScheme="gray">
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
        {isPreviousData && (
          <Box pos="absolute" inset="0" opacity="0.8" zIndex="docked">
            <Skeleton pos="absolute" inset="0" rounded="md" />
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  );
};
