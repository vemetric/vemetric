import { Icon, Text, IconButton, Box, Flex, Grid, Button, Skeleton } from '@chakra-ui/react';
import { Navigate, useParams, useSearch } from '@tanstack/react-router';
import { getTimespanRefetchInterval } from '@vemetric/common/charts/timespans';
import { formatNumber } from '@vemetric/common/math';
import React, { useState } from 'react';
import { TbDatabaseSearch, TbChevronLeft, TbEye } from 'react-icons/tb';
import { EmptyState } from '@/components/ui/empty-state';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { trpc } from '@/utils/trpc';
import { CardBar } from '../card-bar';
import { LIST_CARD_PAGE_SIZE, ListCard } from '../list-card';

interface Props {
  publicDashboard?: boolean;
  eventName: string;
  onBack: () => void;
  onSelectProperty: (property: string) => void;
}

export const EventPropertiesView = ({ publicDashboard, eventName, onBack, onSelectProperty }: Props) => {
  const params = useParams({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { timespan } = useTimespanParam({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const { f: filterConfig } = useSearch({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const [page, setPage] = useState(1);

  const { data, isPreviousData, error } = trpc.dashboard.getEventProperties.useQuery(
    {
      ...params,
      timespan,
      eventName,
      filterConfig,
    },
    {
      keepPreviousData: true,
      refetchInterval: getTimespanRefetchInterval(timespan),
    },
  );

  const mostFiredProperty = data?.properties?.[0];

  if (data?.properties?.length === 1) {
    return (
      <Navigate
        from={publicDashboard ? '/public/$domain' : '/p/$projectId'}
        search={(prev) => ({ ...prev, ep: data?.properties?.[0].name })}
        resetScroll={false}
        replace
      />
    );
  }

  return (
    <Box>
      <Flex gap={2} alignItems="center" mb={2.5}>
        <IconButton size="2xs" variant="surface" colorScheme="gray" onClick={onBack}>
          <Icon as={TbChevronLeft} />
        </IconButton>
        <Text fontWeight="medium">{eventName === '$$outboundLink' ? 'Outbound Link' : eventName}</Text>
      </Flex>
      <ListCard
        list={data?.properties}
        page={page}
        setPage={setPage}
        error={error}
        emptyState={
          <EmptyState icon={<TbDatabaseSearch />} title="No properties were tracked for the selected event" />
        }
      >
        <Grid gridTemplateColumns="minmax(0, 1fr) minmax(50px, auto) minmax(50px, auto)" columnGap={2} rowGap={1.5}>
          <Box fontWeight="semibold" fontSize="sm">
            Property
          </Box>
          <Box fontWeight="semibold" textAlign="center" fontSize="sm">
            Users
          </Box>
          <Box fontWeight="semibold" textAlign="center" fontSize="sm">
            Count
          </Box>
          {data?.properties?.slice((page - 1) * LIST_CARD_PAGE_SIZE, page * LIST_CARD_PAGE_SIZE)?.map((property) => {
            return (
              <React.Fragment key={property.name}>
                <Box className="group" pos="relative" truncate>
                  <CardBar value={property.count} maxValue={mostFiredProperty?.count} />
                  <Box px={2} py={0.5} pos="relative">
                    {property.name}
                  </Box>
                  <Flex
                    zIndex="1"
                    pos="absolute"
                    inset="0"
                    alignItems="center"
                    justify="flex-end"
                    cursor="pointer"
                    onClick={() => {
                      onSelectProperty(property.name);
                    }}
                    transition="all 0.2s ease-in-out"
                    bg="linear-gradient(to right, rgba(0, 0, 0, 0) 60%, var(--chakra-colors-bg-card) 95%)"
                    opacity="0"
                    _groupHover={{ opacity: '1' }}
                  >
                    <Button size="xs" p={0} mr="1px" minW="24px" h="24px" variant="surface" colorScheme="gray">
                      <Icon as={TbEye} />
                    </Button>
                  </Flex>
                </Box>
                <Box textAlign="center">{formatNumber(property.users)}</Box>
                <Box textAlign="center">{formatNumber(property.count)}</Box>
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
