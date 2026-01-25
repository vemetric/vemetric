import { Box, Flex, Grid, Icon, Button, Badge, Text, Card, Skeleton, Link as ChakraLink } from '@chakra-ui/react';
import { Link, useParams } from '@tanstack/react-router';
import { getTimespanRefetchInterval } from '@vemetric/common/charts/timespans';
import type { IFilterConfig } from '@vemetric/common/filters';
import { formatNumber } from '@vemetric/common/math';
import React, { useState } from 'react';
import { TbEye, TbFilter, TbFilterOff, TbWorldWww, TbHome, TbExternalLink, TbUsers } from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { CardIcon } from '~/components/card-icon';
import { NumberCounter } from '~/components/number-counter';
import { EmptyState } from '~/components/ui/empty-state';
import { Tooltip } from '~/components/ui/tooltip';
import { useFilters } from '~/hooks/use-filters';
import { useTimespanParam } from '~/hooks/use-timespan-param';
import { trpc } from '~/utils/trpc';
import { CardBar } from './card-bar';
import { DashboardCardHeader } from './dashboard-card-header';
import { LIST_CARD_PAGE_SIZE, ListCard } from './list-card';

function getDomain(origin: string, projectDomain: string) {
  let domain = origin;
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    domain = domain.replace('http://', '').replace('https://', '');
  }
  domain = domain.replace(projectDomain, '');
  if (domain.startsWith('www.')) {
    domain = domain.slice(4);
  }
  if (domain.endsWith('.')) {
    domain = domain.slice(0, -1);
  }
  return domain;
}

const colorPalette = ['blue', 'orange', 'red', 'pink', 'purple', 'green', 'yellow'];

interface Props {
  filterConfig: IFilterConfig;
  projectDomain: string;
  publicDashboard?: boolean;
}

export const MostVisitedPagesCard = ({ filterConfig, projectDomain, publicDashboard }: Props) => {
  const params = useParams({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { timespan, startDate, endDate } = useTimespanParam({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const [page, setPage] = useState(1);
  const { toggleFilter } = useFilters({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const activeFilters = filterConfig?.filters.filter((f) => f.type === 'page') ?? [];

  const { data, isPreviousData, error } = trpc.dashboard.getData.useQuery(
    { ...params, timespan, startDate, endDate, filterConfig },
    {
      keepPreviousData: true,
      onError: () => {},
      refetchInterval: getTimespanRefetchInterval(timespan),
    },
  );
  const pages = data?.mostVisitedPages ?? [];
  const mostVisitedPage = pages?.[0];

  const domains = Array.from(
    new Set(
      pages
        .filter((page) => page.origin?.includes(projectDomain))
        .map((page) => getDomain(page.origin, projectDomain))
        .sort((a, b) => a.localeCompare(b)),
    ),
  );
  const showDomain = domains.length > 1;
  const filteredDomains = domains.filter((domain) => domain !== '');

  return (
    <Card.Root>
      <DashboardCardHeader>
        <Flex flexDir="column" gap={1}>
          <Flex align="center" gap={1.5}>
            <CardIcon size="xs">
              <TbEye />
            </CardIcon>
            <Text>Top Pages</Text>
          </Flex>
          <Text textStyle="sm" fontWeight="normal" color="fg.muted" pl={0.5}>
            <NumberCounter value={data?.mostVisitedPages.length ?? 0} /> page
            {data?.mostVisitedPages.length !== 1 ? 's' : ''} visited
          </Text>
        </Flex>
      </DashboardCardHeader>
      <Card.Body>
        <ListCard
          list={pages}
          page={page}
          setPage={setPage}
          error={error}
          emptyState={<EmptyState icon={<TbEye />} title="No pages visited in the selected timeframe" />}
        >
          <Grid
            gridTemplateColumns={`${
              showDomain ? 'minmax(0, 50px) ' : ''
            }minmax(0, 4fr) minmax(50px, auto) minmax(50px, auto)`}
            columnGap={2}
            rowGap={1.5}
          >
            {showDomain && (
              <Box mb={1} fontWeight="semibold" fontSize="sm" textAlign="center">
                <Tooltip content="Subdomain">
                  <Icon as={TbWorldWww} />
                </Tooltip>
              </Box>
            )}
            <Box mb={1} fontWeight="semibold" fontSize="sm">
              Path
            </Box>
            <Box fontWeight="semibold" textAlign="center" fontSize="sm">
              Users
            </Box>
            <Box fontWeight="semibold" textAlign="center" fontSize="sm">
              Views
            </Box>
            {pages?.slice((page - 1) * LIST_CARD_PAGE_SIZE, page * LIST_CARD_PAGE_SIZE)?.map((page) => {
              const newFilter = {
                type: 'page',
                pathFilter: { operator: 'is', value: page.pathname },
                originFilter: { operator: 'is', value: page.origin },
              } as const;
              const isFiltered = activeFilters.some((f) => isDeepEqual(f, newFilter));

              const domain = getDomain(page.origin, projectDomain);
              const colorIndex = filteredDomains.indexOf(domain) % colorPalette.length;
              let color = colorPalette[colorIndex];
              if (!domain) {
                color = 'gray';
              }

              return (
                <React.Fragment key={domain + ';' + page.pathname}>
                  {showDomain && (
                    <Flex align="center">
                      <Badge size="sm" colorPalette={color} h="100%" w="100%">
                        <Text w="100%" textAlign="center" truncate>
                          {domain ? domain : <Icon fontSize="15px" as={TbHome} />}
                        </Text>
                      </Badge>
                    </Flex>
                  )}
                  <Flex align="center" pos="relative" truncate className="group" minH="28px">
                    <CardBar value={page.users} maxValue={mostVisitedPage?.users} />
                    <Box px={2} py={0.5} pos="relative" truncate>
                      {page.pathname}
                    </Box>
                    <Tooltip content={page.origin + page.pathname} positioning={{ placement: 'bottom-start' }}>
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
                          <Tooltip content="View users that have viewed this page">
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
                        <Button asChild size="xs" variant="surface" colorScheme="gray" p={0} minW="24px" h="24px">
                          <ChakraLink
                            href={page.origin + page.pathname}
                            target="_blank"
                            rel="noopener noreferrer"
                            outline="none"
                          >
                            <TbExternalLink />
                          </ChakraLink>
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
                    </Tooltip>
                  </Flex>
                  <Box textAlign="center">{formatNumber(page.users)}</Box>
                  <Box textAlign="center">{formatNumber(page.pageViews)}</Box>
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
