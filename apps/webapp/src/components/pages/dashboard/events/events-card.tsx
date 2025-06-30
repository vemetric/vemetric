import { Button, Box, Skeleton, Grid, Icon, Flex, Card, Text, Link as ChakraLink } from '@chakra-ui/react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { IFilterConfig } from '@vemetric/common/filters';
import { formatNumber } from '@vemetric/common/math';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import { TbBolt, TbChartBar, TbChartBarOff, TbEye, TbFilter, TbFilterOff, TbUsers } from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { CardIcon } from '@/components/card-icon';
import { NumberCounter } from '@/components/number-counter';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { useFilters } from '@/hooks/use-filters';
import { trpc } from '@/utils/trpc';
import { CardBar } from '../card-bar';
import { DashboardCardHeader } from '../dashboard-card-header';
import { LIST_CARD_PAGE_SIZE, ListCard } from '../list-card';
import { EventPropertiesView } from './event-properties-view';
import { PropertyView } from './property-view';

const getMotionViewProps = (toLeft?: boolean) => ({
  initial: { x: toLeft ? '-100%' : '100%' },
  animate: { x: 0, transition: { duration: 0.2, bounce: 0 } },
  exit: { x: toLeft ? '-100%' : '100%', transition: { duration: 0.2, bounce: 0 } },
});

interface Props {
  filterConfig: IFilterConfig;
  publicDashboard?: boolean;
}

export const EventsCard = ({ filterConfig, publicDashboard }: Props) => {
  const params = useParams({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const {
    t: timespan,
    e: showEvents,
    se: selectedEvent,
    ep: selectedProperty,
  } = useSearch({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const [page, setPage] = useState(1);
  const { toggleFilter } = useFilters({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });
  const navigate = useNavigate({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const [isAnimating, setIsAnimating] = useState(false);

  const selectEvent = (eventName: string | null, property?: string | null) => {
    setIsAnimating(true);
    setTimeout(() => {
      navigate({
        search: (prev) => ({ ...prev, se: eventName ?? undefined, ep: property ?? undefined }),
        resetScroll: false,
      });
      setTimeout(() => setIsAnimating(false), 300);
    }, 1);
  };

  const activeFilters = filterConfig?.filters.filter((f) => f.type === 'event') ?? [];

  const { data, isPreviousData, error } = trpc.dashboard.getData.useQuery(
    { ...params, timespan, filterConfig },
    { keepPreviousData: true, onError: () => {} },
  );

  const mostFiredEvent = data?.events?.[0];

  return (
    <Card.Root>
      <DashboardCardHeader>
        <Flex align="center" justify="space-between" gap={3} w="100%">
          <Flex flexDir="column" gap={1}>
            <Flex align="center" gap={1.5}>
              <CardIcon size="xs">
                <TbBolt />
              </CardIcon>
              <Text>Events</Text>
            </Flex>
            <Text textStyle="sm" fontWeight="normal" color="fg.muted" pl={0.5}>
              <NumberCounter value={data?.events.length ?? 0} /> event{data?.events.length !== 1 ? 's' : ''} fired
            </Text>
          </Flex>
          <Button
            size="2xs"
            variant="surface"
            colorScheme="gray"
            rounded="sm"
            onClick={() =>
              navigate({
                search: (prev) => ({ ...prev, e: showEvents ? undefined : true }),
                resetScroll: false,
              })
            }
          >
            <Icon as={showEvents ? TbChartBarOff : TbChartBar} />
            {showEvents ? 'Hide from Chart' : 'Show in Chart'}
          </Button>
        </Flex>
      </DashboardCardHeader>
      <Card.Body pos="relative" overflow={isAnimating ? 'hidden' : 'visible'}>
        <AnimatePresence initial={false} mode="popLayout">
          {selectedEvent === undefined ? (
            <motion.div key="list" {...getMotionViewProps(true)}>
              <ListCard
                list={data?.events}
                page={page}
                setPage={setPage}
                error={error}
                emptyState={
                  <EmptyState icon={<TbBolt />} title="No custom events fired in the selected timeframe">
                    <Button asChild mt={4} _hover={{ textDecoration: 'none' }}>
                      <ChakraLink
                        href="https://vemetric.com/docs/product-analytics/tracking-custom-events"
                        target="_blank"
                      >
                        Start tracking custom events
                      </ChakraLink>
                    </Button>
                  </EmptyState>
                }
              >
                <Grid
                  gridTemplateColumns="minmax(0, 1fr) minmax(50px, auto) minmax(50px, auto)"
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
                    Count
                  </Box>
                  {data?.events?.slice((page - 1) * LIST_CARD_PAGE_SIZE, page * LIST_CARD_PAGE_SIZE)?.map((event) => {
                    const newFilter = {
                      type: 'event',
                      nameFilter: { operator: 'is', value: event.name },
                    } as const;
                    const isFiltered = activeFilters.some((f) => isDeepEqual(f, newFilter));

                    return (
                      <React.Fragment key={event.name}>
                        <Box className="group" pos="relative" truncate>
                          <CardBar value={event.users} maxValue={mostFiredEvent?.users} />
                          <Box px={2} py={0.5} pos="relative">
                            {event.name === '$$outboundLink' ? 'Outbound Link' : event.name}
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
                            gap="2"
                            _groupHover={{ opacity: '1' }}
                          >
                            {'projectId' in params && (
                              <Tooltip content="View users that have fired this event">
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
                                selectEvent(event.name);
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
                        <Box textAlign="center">{formatNumber(event.users)}</Box>
                        <Box textAlign="center">{formatNumber(event.count)}</Box>
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
            <motion.div key="event" {...getMotionViewProps(false)}>
              {selectedProperty === undefined ? (
                <EventPropertiesView
                  publicDashboard={publicDashboard}
                  eventName={selectedEvent}
                  onBack={() => selectEvent(null)}
                  onSelectProperty={(property) => selectEvent(selectedEvent, property)}
                />
              ) : (
                <PropertyView
                  publicDashboard={publicDashboard}
                  eventName={selectedEvent}
                  property={selectedProperty}
                  onBack={(to) => {
                    if (to === 'list') {
                      selectEvent(null);
                    } else {
                      selectEvent(selectedEvent, null);
                    }
                  }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card.Body>
    </Card.Root>
  );
};
