import { Icon, Text, IconButton, Box, Flex, Grid, Link, Button } from '@chakra-ui/react';
import { Link as TanstackLink, useParams, useSearch } from '@tanstack/react-router';
import type { IEventFilter } from '@vemetric/common/filters';
import { formatNumber } from '@vemetric/common/math';
import React, { useState } from 'react';
import { TbDatabaseSearch, TbChevronLeft, TbChevronRight, TbUsers, TbFilterOff, TbFilter } from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { useFilters } from '@/hooks/use-filters';
import { trpc } from '@/utils/trpc';
import { CardBar } from '../card-bar';
import { LIST_CARD_PAGE_SIZE, ListCard } from '../list-card';

interface Props {
  publicDashboard?: boolean;
  eventName: string;
  property: string;
  onBack: (to: 'list' | 'event') => void;
}

export const PropertyView = ({ publicDashboard, eventName, property, onBack }: Props) => {
  const params = useParams({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { t: timespan, f: filterConfig } = useSearch({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const [page, setPage] = useState(1);
  const { toggleFilter } = useFilters({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const activeFilters = filterConfig?.filters.filter((f) => f.type === 'event') ?? [];

  const { data, error } = trpc.dashboard.getPropertyValues.useQuery({
    ...params,
    timespan,
    eventName,
    property,
    filterConfig,
  });

  const mostFiredValue = data?.values?.[0];

  return (
    <Box>
      <Flex gap={0.5} alignItems="center" mb={2.5}>
        <IconButton mr={1.5} size="2xs" variant="surface" colorScheme="gray" onClick={() => onBack('list')}>
          <Icon as={TbChevronLeft} />
        </IconButton>
        <Link
          as="button"
          fontWeight="medium"
          onClick={() => onBack('event')}
          focusRing="none"
          _focusVisible={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          {eventName === '$$outboundLink' ? 'Outbound Link' : eventName}
        </Link>
        <Box opacity={0.5}>
          <TbChevronRight />
        </Box>
        <Text fontWeight="medium">{property}</Text>
      </Flex>
      <ListCard
        list={data?.values}
        page={page}
        setPage={setPage}
        error={error}
        emptyState={<EmptyState icon={<TbDatabaseSearch />} title="No values were tracked for the selected property" />}
      >
        <Grid gridTemplateColumns="minmax(0, 1fr) minmax(50px, auto) minmax(50px, auto)" columnGap={2} rowGap={1.5}>
          <Box fontWeight="semibold" fontSize="sm">
            Value
          </Box>
          <Box fontWeight="semibold" textAlign="center" fontSize="sm">
            Users
          </Box>
          <Box fontWeight="semibold" textAlign="center" fontSize="sm">
            Count
          </Box>
          {data?.values?.slice((page - 1) * LIST_CARD_PAGE_SIZE, page * LIST_CARD_PAGE_SIZE)?.map((value) => {
            const newFilter = {
              type: 'event',
              nameFilter: { operator: 'is', value: eventName },
              propertiesFilter: [{ property, valueFilter: { operator: 'is', value: value.name } }],
            } satisfies IEventFilter;
            const isFiltered = activeFilters.some((f) => isDeepEqual(f, newFilter));

            return (
              <React.Fragment key={value.name}>
                <Box className="group" pos="relative" truncate>
                  <CardBar value={value.count} maxValue={mostFiredValue?.count} />
                  <Box px={2} py={0.5} pos="relative">
                    {value.name}
                  </Box>
                  <Flex
                    zIndex="1"
                    pos="absolute"
                    inset="0"
                    alignItems="center"
                    justify="flex-end"
                    transition="all 0.2s ease-in-out"
                    bg="linear-gradient(to right, rgba(0, 0, 0, 0) 30%, var(--chakra-colors-bg-card) 85%)"
                    opacity="0"
                    _groupHover={{ opacity: '1' }}
                  >
                    {'projectId' in params && (
                      <Tooltip content="View users that have fired this event">
                        <Button
                          asChild
                          size="xs"
                          p={0}
                          mr={2}
                          minW="24px"
                          h="24px"
                          variant="surface"
                          colorScheme="gray"
                        >
                          <TanstackLink
                            to="/p/$projectId/users"
                            params={{ projectId: params.projectId }}
                            search={{
                              f: { filters: [newFilter], operator: 'and' },
                              s: { by: newFilter },
                            }}
                          >
                            <Icon as={TbUsers} />
                          </TanstackLink>
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
                      onClick={() => {
                        toggleFilter(newFilter);
                      }}
                    >
                      <Icon color={isFiltered ? 'purple.500' : undefined} as={isFiltered ? TbFilterOff : TbFilter} />
                    </Button>
                  </Flex>
                </Box>
                <Box textAlign="center">{formatNumber(value.users)}</Box>
                <Box textAlign="center">{formatNumber(value.count)}</Box>
              </React.Fragment>
            );
          })}
        </Grid>
      </ListCard>
    </Box>
  );
};
