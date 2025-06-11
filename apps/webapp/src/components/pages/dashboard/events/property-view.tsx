import { Icon, Text, IconButton, Box, Flex, Grid, Link } from '@chakra-ui/react';
import { useParams, useSearch } from '@tanstack/react-router';
import { formatNumber } from '@vemetric/common/math';
import React, { useState } from 'react';
import { TbDatabaseSearch, TbChevronLeft, TbChevronRight } from 'react-icons/tb';
import { EmptyState } from '@/components/ui/empty-state';
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
            return (
              <React.Fragment key={value.name}>
                <Box className="group" pos="relative" truncate>
                  <CardBar value={value.count} maxValue={mostFiredValue?.count} />
                  <Box px={2} py={0.5} pos="relative">
                    {value.name}
                  </Box>
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
