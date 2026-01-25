import { Box, Card, Flex, SimpleGrid, LinkOverlay, Skeleton, Spinner, Button, Icon } from '@chakra-ui/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { filterConfigSchema } from '@vemetric/common/filters';
import { useEffect } from 'react';
import { TbArrowDown, TbActivity } from 'react-icons/tb';
import { groupBy } from 'remeda';
import { z } from 'zod';
import { AddFilterButton } from '~/components/filter/add-filter/add-filter-button';
import { FilterContainer } from '~/components/filter/filter-container';
import { FilterContextProvider } from '~/components/filter/filter-context';
import { DateSeparator } from '~/components/pages/user/date-separator';
import { SessionEventGroup } from '~/components/pages/user/session-event-group';
import { UserDetailColumn } from '~/components/pages/user/user-detail-column';
import { EmptyState } from '~/components/ui/empty-state';
import { useSetBreadcrumbs, useSetDocsLink } from '~/stores/header-store';
import { dateTimeFormatter } from '~/utils/date-time-formatter';
import { trpc } from '~/utils/trpc';
import { getUserName } from '~/utils/user';

const userSearchSchema = z.object({
  date: z.string().optional(),
  f: filterConfigSchema,
});

export const Route = createFileRoute('/_layout/p/$projectId/users/$userId')({
  component: Page,
  validateSearch: zodValidator(userSearchSchema),
});

function Page() {
  const { projectId, userId } = Route.useParams();
  const { date } = Route.useSearch();
  const { f: filterConfig } = Route.useSearch();
  const navigate = Route.useNavigate();

  // Query for user details and latest event
  const { data: filterableData, isLoading: _isFilterableDataLoading } = trpc.filters.getFilterableData.useQuery({
    projectId,
    timespan: '30days',
  });
  const { data: userData, isLoading: _isUserLoading } = trpc.users.single.useQuery({
    projectId,
    userId,
  });

  // Query for paginated events
  const {
    data: eventsData,
    isLoading: _isEventsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPreviousData,
  } = trpc.users.events.useInfiniteQuery(
    { projectId, userId, date, filterConfig },
    { keepPreviousData: true, getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const latestEvent = userData?.latestEvent;
  const events = eventsData?.pages.flatMap((page) => page.events ?? []) ?? [];
  const flatSessions = eventsData?.pages.flatMap((page) => page.sessions ?? []) ?? [];
  const sessions = flatSessions.map((session) => ({
    ...session,
    date: dateTimeFormatter.formatDate(session.startedAt),
  }));
  const startDate = eventsData?.pages[0]?.startDate;

  const lastPage = eventsData?.pages[eventsData?.pages.length - 1];
  const isNextEventSameSession = lastPage?.isNextEventSameSession ?? false;

  const groupedEvents = Object.entries(groupBy(events, (event) => event.sessionId));
  const user = userData?.user;

  const isUserLoading = _isUserLoading || !userData;
  const isEventsLoading = !eventsData || (isPreviousData && events.length === 0);

  const countryCode = user?.countryCode || latestEvent?.countryCode;
  const isOnline = Boolean(latestEvent?.isOnline);

  let lastDate: string | null = null;

  const userName = getUserName(user?.displayName, user?.identifier);
  useSetBreadcrumbs([
    <LinkOverlay key="users" asChild>
      <Link to="/p/$projectId/users" params={{ projectId }}>
        Users
      </Link>
    </LinkOverlay>,
    isUserLoading ? <Skeleton key="user-name" w="100px" h="20px" rounded="md" /> : userName,
  ]);
  useSetDocsLink('https://vemetric.com/docs/product-analytics/user-journeys');

  const hasFilters = filterConfig && filterConfig.filters.length > 0;
  const serializedFilters = JSON.stringify(filterConfig);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [serializedFilters]);

  return (
    <FilterContextProvider
      value={{
        pagePaths: filterableData?.pagePaths ?? [],
        origins: filterableData?.origins ?? [],
        eventNames: filterableData?.eventNames ?? [],
        browserNames: filterableData?.browserNames ?? [],
        deviceTypes: filterableData?.deviceTypes ?? [],
        osNames: filterableData?.osNames ?? [],

        disabledFilters: ['funnel', 'referrer', 'referrerUrl', 'referrerType', 'utmTags', 'location', 'user'],
        countryCodes: [],
        funnels: [],
        referrers: [],
        referrerUrls: [],
        utmCampaigns: [],
        utmContents: [],
        utmMediums: [],
        utmSources: [],
        utmTerms: [],
      }}
    >
      <Box
        pos="sticky"
        top={{ base: '50px', md: '126px', lg: '58px' }}
        left={0}
        right={0}
        mt={-3}
        h={{ base: 5, md: 3 }}
        bg="bg.content"
        w="100%"
        zIndex="3"
      />
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: 12, md: 6 }} p={1} pt={0}>
        <Flex order={{ base: 1, md: 0 }} flexDir="column" pos="relative">
          <FilterContainer filterConfig={filterConfig} from="/p/$projectId/users/$userId" />
          <Flex
            pos="sticky"
            top={{
              base: hasFilters ? '54px' : '70px',
              md: hasFilters ? '124px' : '140px',
              lg: hasFilters ? '54px' : '70px',
            }}
            zIndex="5"
          >
            <Flex flexGrow={1} gap={2.5} justify="flex-end" pos="absolute" top={hasFilters ? 4 : 0} right={0}>
              <AddFilterButton from="/p/$projectId/users/$userId" filterConfig={filterConfig} />
            </Flex>
          </Flex>
          <Flex flexDir="column" gap={8} mt={hasFilters ? 4 : 0}>
            {isEventsLoading ? (
              <>
                <DateSeparator>
                  <Spinner size="xs" borderWidth="1.5px" mx={4} />
                </DateSeparator>
                <Skeleton h="90px" w="100%" rounded="xl" />
                <Box
                  h="1px"
                  bg="linear-gradient(to right, rgba(0,0,0,0) 0%, var(--chakra-colors-gray-emphasized) 50%, rgba(0,0,0,0) 100%)"
                  opacity={0.3}
                />
                <Skeleton h="90px" w="100%" rounded="xl" />
              </>
            ) : events.length > 0 ? (
              <>
                {groupedEvents.map(([sessionId, events], index) => {
                  const isLastSession = index === groupedEvents.length - 1;
                  const session = sessions.find((s) => s.id === sessionId);
                  let renderDate = false;
                  const lastDateWasNull = lastDate === null;
                  if (session) {
                    renderDate = session.date !== lastDate;
                    lastDate = session.date;
                  }

                  return (
                    <SessionEventGroup
                      key={sessionId}
                      index={index}
                      showOnlineTag={isOnline && latestEvent?.sessionId === sessionId}
                      session={session}
                      isLastSession={isLastSession}
                      renderDate={renderDate}
                      lastDateWasNull={lastDateWasNull}
                      isNextEventSameSession={isNextEventSameSession}
                      isPreviousData={isPreviousData}
                      events={events}
                    />
                  );
                })}
                {hasNextPage && (
                  <Flex justify="center" mt={-4}>
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
            ) : (
              <Card.Root rounded="xl">
                <EmptyState
                  icon={<TbActivity />}
                  title="No events found"
                  description={
                    filterConfig
                      ? `No events match the selected filters${date ? ' on the selected date' : ''}.`
                      : date
                        ? startDate && new Date(date) < startDate
                          ? 'Upgrade to the Professional plan for longer data retention.'
                          : 'There are no events for this user on the selected date.'
                        : 'There are no events for this user yet.'
                  }
                >
                  {(date || filterConfig) && (
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate({ resetScroll: false, search: (prev) => ({ ...prev, date: undefined, f: undefined }) })
                      }
                    >
                      See all events
                    </Button>
                  )}
                </EmptyState>
              </Card.Root>
            )}
          </Flex>
        </Flex>
        <UserDetailColumn
          projectId={projectId}
          userId={userId}
          countryCode={countryCode}
          isUserLoading={isUserLoading}
          isEventsLoading={isEventsLoading}
          userName={userName}
          selectedDate={date}
          isOnline={isOnline}
        />
      </SimpleGrid>
    </FilterContextProvider>
  );
}
