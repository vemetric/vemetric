import { Box, Flex, Spinner, Icon, Button, Card, Link as ChakraLink } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { filterConfigSchema } from '@vemetric/common/filters';
import { AnimatePresence } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';
import { TbActivity, TbArrowDown } from 'react-icons/tb';
import { groupBy } from 'remeda';
import { z } from 'zod';
import { AddFilterButton } from '@/components/filter/add-filter/add-filter-button';
import { FilterContainer } from '@/components/filter/filter-container';
import { FilterContextProvider } from '@/components/filter/filter-context';
import { PageDotBackground } from '@/components/page-dot-background';
import { EventCard, EventCardSkeleton } from '@/components/pages/events/event-card';
import { DateSeparator } from '@/components/pages/user/date-separator';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Status } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import { EventsPageStoreProvider } from '@/stores/events-page-store';
import { useSetBreadcrumbs, useSetDocsLink } from '@/stores/header-store';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { observeResize } from '@/utils/dom';
import { trpc } from '@/utils/trpc';

const eventsSearchSchema = z.object({
  f: filterConfigSchema,
});

export const Route = createFileRoute('/_layout/p/$projectId/events/')({
  validateSearch: zodValidator(eventsSearchSchema),
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { f: filterConfig } = Route.useSearch();
  const hasActiveFilters = filterConfig && filterConfig.filters.length > 0;
  const filterContainerRef = useRef<HTMLDivElement>(null);
  const [filterContainerHeight, setFilterContainerHeight] = useState(0);

  const { data: filterableData, isLoading: isFilterableDataLoading } = trpc.filters.getFilterableData.useQuery({
    projectId,
    timespan: '30days',
  });

  const {
    data: eventsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.events.list.useInfiniteQuery(
    { projectId, filterConfig },
    {
      keepPreviousData: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 5000,
    },
  );

  const nextEventDate = dateTimeFormatter.formatDate(
    eventsData?.pages[eventsData?.pages.length - 1]?.nextCursor ?? new Date(),
  );
  const nowDate = dateTimeFormatter.formatDate(new Date());
  const events = (eventsData?.pages.flatMap((page) => page.events ?? []) ?? []).map((event) => ({
    ...event,
    date: dateTimeFormatter.formatDate(event.createdAt),
  }));
  const groupedEvents = Object.entries(groupBy(events, (event) => event.date));

  useSetBreadcrumbs(['Events']);
  useSetDocsLink('https://vemetric.com/docs/product-analytics/tracking-custom-events');

  useEffect(() => {
    if (isLoading || isFilterableDataLoading) {
      return;
    }

    if (!hasActiveFilters || !filterContainerRef.current) {
      setFilterContainerHeight(0);
      return;
    }

    const observer = observeResize({
      element: filterContainerRef.current,
      callback: () => {
        setFilterContainerHeight(filterContainerRef.current?.clientHeight ?? 0);
      },
    });

    return () => observer.disconnect();
  }, [hasActiveFilters, isLoading, isFilterableDataLoading]);

  if (isLoading || isFilterableDataLoading) {
    return (
      <>
        <PageDotBackground />
        <Flex gap={3} mb={3} justify="flex-end">
          <Skeleton height={[7, 9]} width={['60px', '80px']} loading />
        </Flex>
        <Flex flexDir="column" gap="6" pos="relative" maxW="500px" mx="auto">
          <DateSeparator>
            <Spinner size="xs" borderWidth="1.5px" mx={4} />
          </DateSeparator>
          <Box rounded="xl" overflow="hidden" bg="bg.card" border="1px solid" borderColor="gray.emphasized">
            <EventCardSkeleton borderBottom="1px solid" borderColor="gray.emphasized" />
            <EventCardSkeleton borderBottom="1px solid" borderColor="gray.emphasized" />
            <EventCardSkeleton />
          </Box>
        </Flex>
      </>
    );
  }

  return (
    <EventsPageStoreProvider>
      <FilterContextProvider
        value={{
          eventNames: filterableData?.eventNames ?? [],
          countryCodes: filterableData?.countryCodes ?? [],
          browserNames: filterableData?.browserNames ?? [],
          deviceTypes: filterableData?.deviceTypes ?? [],
          osNames: filterableData?.osNames ?? [],

          defaultOperator: 'or',
          disabledFilters: ['page', 'referrer', 'referrerUrl', 'referrerType', 'utmTags', 'funnel'],
          // we leave data empty for filters that are not available on the events page
          pagePaths: [],
          origins: [],
          referrers: [],
          referrerUrls: [],
          utmCampaigns: [],
          utmContents: [],
          utmMediums: [],
          utmSources: [],
          utmTerms: [],
          funnels: [],
        }}
      >
        <PageDotBackground />
        <Box mt={-3} pos="sticky" top={{ base: '44px', md: '122px', lg: '52px' }} zIndex="dropdown">
          <Flex
            ref={filterContainerRef}
            pt={3}
            bg={hasActiveFilters ? 'bg.content' : 'transparent'}
            flexWrap="wrap"
            w="100%"
            columnGap={8}
            rowGap={4}
            align="center"
          >
            <FilterContainer filterConfig={filterConfig} from="/p/$projectId/events" />
            <Flex flexGrow={1} gap={2.5} justify="flex-end">
              <AddFilterButton from="/p/$projectId/events" filterConfig={filterConfig} />
            </Flex>
          </Flex>
          <Box h={3} w="full" bg={hasActiveFilters ? 'bg.content' : 'transparent'} />
        </Box>
        <Box
          pos="sticky"
          top={{
            base: `${50 + filterContainerHeight}px`,
            md: `${126 + filterContainerHeight}px`,
            lg: `${58 + filterContainerHeight}px`,
          }}
          left={0}
          right={0}
          mt={-3}
          h={{ base: 5, md: 4, lg: 3 }}
          bg="bg.content"
          w="100%"
          maxW="500px"
          mx="auto"
          zIndex="3"
        />
        <Box
          pos="fixed"
          top={0}
          transition="all 0.2s ease-in-out"
          transform={{
            base: `translateY(${58 + filterContainerHeight}px)`,
            md: `translateY(${140 + filterContainerHeight}px)`,
            lg: `translateY(${70 + filterContainerHeight}px)`,
          }}
          zIndex="dropdown"
        >
          <Box w="fit-content">
            <Tooltip content={`New events will appear automatically`}>
              <Flex
                align="center"
                gap={2}
                fontSize="sm"
                fontWeight="medium"
                color="green.fg"
                border="1px solid"
                borderColor="green.emphasized/60"
                bg="green.subtle/60"
                rounded="md"
                px={1.5}
                py={0.5}
              >
                <Status value="success" />
                Live
              </Flex>
            </Tooltip>
          </Box>
        </Box>
        <Box pb={4} pos="relative">
          {events.length === 0 ? (
            <Box mt={4} mx="auto" pos="relative" maxW="500px">
              <Card.Root rounded="xl">
                <EmptyState
                  icon={<TbActivity />}
                  title={
                    !filterConfig || filterConfig.filters.length === 0
                      ? 'No events found'
                      : 'No events matching your filters'
                  }
                  description={
                    <>
                      Start{' '}
                      <ChakraLink
                        colorPalette="purple"
                        href="https://vemetric.com/docs/product-analytics/tracking-custom-events"
                      >
                        tracking events
                      </ChakraLink>{' '}
                      in your application to see them here.
                    </>
                  }
                />
              </Card.Root>
            </Box>
          ) : (
            <>
              <Flex flexDir="column" gap="6" mx="auto" maxW="500px">
                {groupedEvents.map(([date, events], index) => {
                  const isLastDate = index === groupedEvents.length - 1;
                  const isCompleteDate = !isLastDate || nextEventDate !== date;

                  return (
                    <React.Fragment key={date}>
                      <Box
                        pos="sticky"
                        top={{
                          base: `${58 + filterContainerHeight}px`,
                          md: `${140 + filterContainerHeight}px`,
                          lg: `${70 + filterContainerHeight}px`,
                        }}
                        zIndex="4"
                        mb={-5}
                        pb={5}
                      >
                        <Box
                          pos="absolute"
                          left={0}
                          right={0}
                          top={-3}
                          h={3}
                          bg="linear-gradient(to top, var(--chakra-colors-bg-content), rgba(255,255,255,0))"
                        />
                        <DateSeparator>{date === nowDate ? 'Today' : date}</DateSeparator>
                        <Box
                          pos="absolute"
                          left={0}
                          right={0}
                          bottom={0}
                          h={5}
                          bg="linear-gradient(to bottom, var(--chakra-colors-bg-content) 10%, rgba(255,255,255,0) 100%)"
                        />
                      </Box>
                      <Box>
                        <Flex
                          flexDir="column"
                          css={{
                            '& > div:not(:last-of-type) [data-event-card]': {
                              borderBottomWidth: '0px',
                              roundedBottom: 'none',
                            },
                            '& > div:first-of-type [data-event-card]': {
                              roundedTop: 'xl',
                            },
                            '& > div:last-of-type [data-event-card]': {
                              roundedBottom: isLastDate && !isCompleteDate ? 'none' : 'xl',
                              borderBottomWidth: isLastDate && !isCompleteDate ? '0px' : '1px',
                            },
                          }}
                        >
                          <AnimatePresence mode="sync" initial={false}>
                            {events.map((event, index) => (
                              <EventCard
                                key={event.id}
                                event={event}
                                previousEventId={events[index - 1]?.id}
                                nextEventId={events[index + 1]?.id}
                              />
                            ))}
                          </AnimatePresence>
                        </Flex>
                        {!isCompleteDate && (
                          <Box
                            borderTop="1px solid"
                            borderColor="gray.emphasized"
                            w="100%"
                            h="40px"
                            bg="linear-gradient(to bottom, var(--chakra-colors-bg-card), rgba(255,255,255,0))"
                            pos="relative"
                          >
                            <Box
                              pos="absolute"
                              left="0"
                              w="1px"
                              h="100%"
                              bg="linear-gradient(to bottom, var(--chakra-colors-gray-emphasized), rgba(0,0,0,0))"
                            />
                            <Box
                              pos="absolute"
                              right="0"
                              w="1px"
                              h="100%"
                              bg="linear-gradient(to bottom, var(--chakra-colors-gray-emphasized), rgba(0,0,0,0))"
                            />
                          </Box>
                        )}
                      </Box>
                    </React.Fragment>
                  );
                })}
              </Flex>
              {hasNextPage && (
                <Flex justify="center" mt={4}>
                  <Button
                    onClick={() => fetchNextPage()}
                    loading={isFetchingNextPage}
                    variant="surface"
                    size="md"
                    rounded="xl"
                  >
                    <Icon boxSize={4.5} asChild>
                      <TbArrowDown />
                    </Icon>
                    Load More
                  </Button>
                </Flex>
              )}
            </>
          )}
        </Box>
      </FilterContextProvider>
    </EventsPageStoreProvider>
  );
}
