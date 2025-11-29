import { Button, Box, Skeleton, Grid, Icon, Flex, Card, Text, Link as ChakraLink } from '@chakra-ui/react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { getTimespanRefetchInterval } from '@vemetric/common/charts/timespans';
import type { IFilterConfig } from '@vemetric/common/filters';
import { formatNumber } from '@vemetric/common/math';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import {
  TbBolt,
  TbChartBar,
  TbChartBarOff,
  TbExternalLink,
  TbEye,
  TbFilter,
  TbFilterOff,
  TbUsers,
} from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { CardIcon } from '@/components/card-icon';
import { CustomIconStyle } from '@/components/custom-icon-style';
import { NumberCounter } from '@/components/number-counter';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { useProjectContext } from '@/contexts/project-context';
import { useFilters } from '@/hooks/use-filters';
import { useTimespanParam } from '@/hooks/use-timespan-param';
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
  const { timespan, startDate, endDate } = useTimespanParam({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const { e: showEvents, me: selectedEvent } = useSearch({
    from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/',
  });
  const [page, setPage] = useState(1);
  const { toggleFilter } = useFilters({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });
  const navigate = useNavigate({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });
  const { eventIcons } = useProjectContext();

  const selectEvent = (eventName: string | null, property?: string | null) => {
    navigate({
      search: (prev) => ({ ...prev, me: eventName ? { n: eventName, p: property ?? undefined } : undefined }),
      params: (prev) => prev,
      resetScroll: false,
    });
  };

  const activeFilters = filterConfig?.filters.filter((f) => f.type === 'event') ?? [];

  const { data, isPreviousData, error } = trpc.dashboard.getData.useQuery(
    { ...params, timespan, startDate, endDate, filterConfig },
    {
      keepPreviousData: true,
      onError: () => {},
      refetchInterval: getTimespanRefetchInterval(timespan),
    },
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
                params: (prev) => prev,
                resetScroll: false,
              })
            }
          >
            <Icon as={showEvents ? TbChartBarOff : TbChartBar} />
            {showEvents ? 'Hide from Chart' : 'Show in Chart'}
          </Button>
        </Flex>
      </DashboardCardHeader>
      <Card.Body pos="relative" overflow="hidden" css={{ '& > div': { h: '100%' } }}>
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
                    <Button size="sm" asChild mt={2} _hover={{ textDecoration: 'none' }}>
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

                    let icon = <TbBolt />;
                    if (event.name === '$$outboundLink') {
                      icon = <TbExternalLink />;
                    } else if (eventIcons[event.name]) {
                      icon = <CustomIconStyle transform="scale(0.8)">{eventIcons[event.name]}</CustomIconStyle>;
                    }

                    return (
                      <React.Fragment key={event.name}>
                        <Box className="group" pos="relative" truncate>
                          <CardBar value={event.users} maxValue={mostFiredEvent?.users} />
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
                              fontSize="sm"
                            >
                              {icon}
                            </Flex>
                            <Box>{event.name === '$$outboundLink' ? 'Outbound Link' : event.name}</Box>
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
                            {'projectId' in params && (
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
              {selectedEvent.p === undefined ? (
                <EventPropertiesView
                  publicDashboard={publicDashboard}
                  eventName={selectedEvent.n}
                  onBack={() => selectEvent(null)}
                  onSelectProperty={(property) => selectEvent(selectedEvent.n, property)}
                />
              ) : (
                <PropertyView
                  publicDashboard={publicDashboard}
                  eventName={selectedEvent.n}
                  property={selectedEvent.p}
                  onBack={(to) => {
                    if (to === 'list') {
                      selectEvent(null);
                    } else {
                      selectEvent(selectedEvent.n, null);
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
