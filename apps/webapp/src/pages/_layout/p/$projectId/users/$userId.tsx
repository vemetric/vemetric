import {
  Box,
  Card,
  HStack,
  Flex,
  Heading,
  SimpleGrid,
  Text,
  Tag,
  Link as ChakraLink,
  LinkOverlay,
  Skeleton,
  Spinner,
  Button,
  Icon,
  Alert,
  Span,
} from '@chakra-ui/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { COUNTRIES } from '@vemetric/common/countries';
import { filterConfigSchema } from '@vemetric/common/filters';
import { Fragment, useEffect, useRef, useState } from 'react';
import { TbArrowDown, TbDirectionSign, TbEye, TbDatabaseSearch, TbUserQuestion, TbActivity } from 'react-icons/tb';
import { groupBy } from 'remeda';
import SimpleBar from 'simplebar-react';
import { z } from 'zod';
import { BrowserIcon } from '@/components/browser-icon';
import { CardIcon } from '@/components/card-icon';
import { CountryFlag } from '@/components/country-flag';
import { DeviceIcon } from '@/components/device-icon';
import { AddFilterButton } from '@/components/filter/add-filter/add-filter-button';
import { FilterContainer } from '@/components/filter/filter-container';
import { FilterContextProvider } from '@/components/filter/filter-context';
import { LoadingImage } from '@/components/loading-image';
import { OsIcon } from '@/components/os-icon';
import { ActivityHeatmap } from '@/components/pages/user/activity-heatmap';
import { DateSeparator } from '@/components/pages/user/date-separator';
import { EventCard } from '@/components/pages/user/event-card';
import { RenderAttributeValue } from '@/components/pages/user/render-attribute-value';
import { UserAvatar } from '@/components/pages/user/user-avatar';
import { UserFunnelProgress } from '@/components/pages/user/user-funnel-progress';
import { EmptyState } from '@/components/ui/empty-state';
import { Status } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import { useSetBreadcrumbs, useSetDocsLink } from '@/stores/header-store';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { observeResize } from '@/utils/dom';
import { getFaviconUrl } from '@/utils/favicon';
import { trpc } from '@/utils/trpc';
import { formatQueryParams } from '@/utils/url';
import { getUserName } from '@/utils/user';

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

  const scrollableContentRef = useRef<HTMLDivElement>(null);
  const scrollableNodeRef = useRef<HTMLDivElement>();
  const [topOverlayVisible, setTopOverlayVisible] = useState(false);
  const [bottomOverlayVisible, setBottomOverlayVisible] = useState(false);
  const calcScrollableOverlays = (target: HTMLDivElement) => {
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    if (clientHeight >= scrollHeight) {
      setTopOverlayVisible(false);
      setBottomOverlayVisible(false);
      return;
    }

    if (scrollTop > 0) {
      setTopOverlayVisible(true);
    } else {
      setTopOverlayVisible(false);
    }

    if (scrollHeight - clientHeight - scrollTop > 0) {
      setBottomOverlayVisible(true);
    } else {
      setBottomOverlayVisible(false);
    }
  };

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

  const nowDate = dateTimeFormatter.formatDate(new Date());
  const groupedEvents = Object.entries(groupBy(events, (event) => event.sessionId));
  const user = userData?.user;
  const deviceData = userData?.deviceData;

  const isUserLoading = _isUserLoading || !userData;
  const isEventsLoading = !eventsData || (isPreviousData && events.length === 0);

  useEffect(() => {
    if (!scrollableContentRef.current) {
      return;
    }

    observeResize({
      element: scrollableContentRef.current,
      callback: () => {
        if (!scrollableNodeRef.current) {
          return;
        }

        calcScrollableOverlays(scrollableNodeRef.current);
      },
    });
  }, [isUserLoading, isEventsLoading]);

  const countryCode = user?.countryCode || latestEvent?.countryCode;
  const isOnline = latestEvent?.isOnline;

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
          <Flex pos="sticky" top={{ base: '56px', md: '126px', lg: '56px' }} zIndex="5">
            <Flex flexGrow={1} gap={2.5} justify="flex-end" pos="absolute" top={4} right={0}>
              <AddFilterButton from="/p/$projectId/users/$userId" filterConfig={filterConfig} />
            </Flex>
          </Flex>
          <Flex flexDir="column" gap={8} mt={4}>
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
                  const session = sessions.find((s) => s.id === sessionId);
                  const isLastSession = index === groupedEvents.length - 1;
                  const isCompleteSession = !isLastSession || !isNextEventSameSession;

                  let renderDate = false;
                  const lastDateWasNull = lastDate === null;
                  if (session) {
                    renderDate = session.date !== lastDate;
                    lastDate = session.date;
                  }

                  let lastPageViewDate: string | null = null;

                  return (
                    <Fragment key={sessionId}>
                      {index > 0 && !renderDate && (
                        <Box
                          h="1px"
                          bg="linear-gradient(to right, rgba(0,0,0,0) 0%, var(--chakra-colors-gray-emphasized) 50%, rgba(0,0,0,0) 100%)"
                          opacity={0.3}
                        />
                      )}
                      {renderDate && (
                        <>
                          <Box
                            pos="sticky"
                            top={{ base: '70px', md: '140px', lg: '70px' }}
                            zIndex="4"
                            mt={lastDateWasNull ? 0 : 6}
                            mb={-3}
                            pb={3}
                          >
                            <Box
                              pos="absolute"
                              left={0}
                              right={0}
                              top={-3}
                              h={3}
                              bg="linear-gradient(to top, var(--chakra-colors-bg-content), rgba(255,255,255,0))"
                            />
                            <DateSeparator>{session?.date === nowDate ? 'Today' : session?.date}</DateSeparator>
                            <Box
                              pos="absolute"
                              left={0}
                              right={0}
                              bottom={0}
                              h={3}
                              bg="linear-gradient(to bottom, var(--chakra-colors-bg-content), rgba(255,255,255,0))"
                            />
                          </Box>
                        </>
                      )}
                      <Flex flexDir="column" className="group">
                        {session && (
                          <Flex justify="space-between" px={2.5}>
                            <Flex align="flex-end">
                              {isOnline && latestEvent?.sessionId === sessionId && (
                                <>
                                  <Box
                                    height="16px"
                                    width="10px"
                                    borderColor="green.500"
                                    opacity={0.5}
                                    borderLeftWidth="1.5px"
                                    borderTopWidth="1.5px"
                                    roundedTopLeft="md"
                                  />
                                  <Tooltip content="This session is currently active">
                                    <Tag.Root mb={1} size="lg" rounded="md" colorPalette="green" fontWeight="medium">
                                      <Tag.Label>Online</Tag.Label>
                                    </Tag.Root>
                                  </Tooltip>
                                </>
                              )}
                            </Flex>
                            <Tooltip
                              content={
                                <>
                                  <Text>
                                    Session ended at {dateTimeFormatter.formatDateTime(session?.endedAt ?? '')}
                                  </Text>
                                  <Text mt={2}>
                                    Session took{' '}
                                    {session.startedAt !== session.endedAt
                                      ? dateTimeFormatter.formatDistance(session.startedAt, session.endedAt)
                                      : 'less than a minute'}
                                  </Text>
                                </>
                              }
                            >
                              <Text textStyle="sm" opacity={0.5} my={1}>
                                {dateTimeFormatter.formatTime(session?.endedAt ?? '')}
                              </Text>
                            </Tooltip>
                          </Flex>
                        )}
                        <Box pos="relative">
                          <Flex
                            flexDir="column"
                            rounded="xl"
                            css={{
                              '& > div': {
                                rounded: 'none',
                                borderBottomWidth: '0px',
                                _first: { roundedTop: 'xl' },
                                _last: isCompleteSession ? { borderBottomWidth: '1px', roundedBottom: 'xl' } : {},
                              },
                            }}
                          >
                            {events.map((event) => {
                              const eventCard = (
                                <EventCard
                                  key={event.id}
                                  event={event}
                                  lastPageViewDate={lastPageViewDate ?? session?.endedAt}
                                />
                              );

                              if (event.name === '$$pageView') {
                                lastPageViewDate = event.createdAt;
                              }

                              return eventCard;
                            })}
                            {!isCompleteSession && (
                              <Box
                                borderTop="1px solid"
                                borderColor="gray.emphasized"
                                roundedTop="xl"
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
                          </Flex>
                          {isPreviousData && <Skeleton rounded="xl" pos="absolute" inset={0} />}
                        </Box>
                        {session ? (
                          isCompleteSession ? (
                            <Flex justify="space-between" px={2.5}>
                              <Flex align="flex-start">
                                <Box
                                  height="16px"
                                  width="10px"
                                  borderColor="gray.emphasized"
                                  borderLeftWidth="1.5px"
                                  borderBottomWidth="1.5px"
                                  roundedBottomLeft="md"
                                />
                                <Tooltip
                                  content={
                                    session.referrer ? `Referred via ${session.referrerUrl}` : `Direct page visit.`
                                  }
                                >
                                  <Tag.Root mt={1} size="lg" rounded="md" colorPalette="gray" px={1} pr={1.5}>
                                    <Tag.Label display="flex" alignItems="center" gap={1}>
                                      <Flex
                                        align="center"
                                        justify="center"
                                        flexShrink={0}
                                        boxSize="18px"
                                        bg="gray.subtle"
                                        rounded="4px"
                                        color="gray.fg"
                                        overflow="hidden"
                                      >
                                        {session.referrer && session.referrerUrl ? (
                                          <LoadingImage
                                            src={getFaviconUrl(session.referrerUrl)}
                                            alt={session.referrer + ' Favicon'}
                                            boxSize="16px"
                                          />
                                        ) : (
                                          <TbDirectionSign />
                                        )}
                                      </Flex>
                                      {session.referrer || 'Direct'}
                                    </Tag.Label>
                                  </Tag.Root>
                                </Tooltip>
                              </Flex>
                              <Tooltip
                                content={`Session started at ${dateTimeFormatter.formatDateTime(
                                  session?.startedAt ?? '',
                                )}`}
                              >
                                <Text textStyle="sm" opacity={0.5} mt={1}>
                                  {dateTimeFormatter.formatTime(session?.startedAt ?? '')}
                                </Text>
                              </Tooltip>
                            </Flex>
                          ) : null
                        ) : (
                          <Text color="fg.error" textStyle="sm">
                            Unkown Session
                          </Text>
                        )}
                      </Flex>
                    </Fragment>
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
        <Box>
          <Box
            position="sticky"
            top={{ base: '70px', md: '140px', lg: '70px' }}
            css={{
              '& .simplebar-wrapper': {
                maxH: { base: 'none', md: 'calc(100vh - 160px)', lg: 'calc(100vh - 90px)' },
              },
            }}
          >
            <SimpleBar
              scrollableNodeProps={{
                ref: scrollableNodeRef,
                onScroll: (e: any) => {
                  calcScrollableOverlays(e.target as HTMLDivElement);
                },
              }}
            >
              <Flex flexDir="column" gap={3} ref={scrollableContentRef}>
                {isUserLoading ? (
                  <Flex flexDir="column" gap={3}>
                    <Skeleton h="100px" w="100%" rounded="xl" />
                    <Skeleton h="100px" w="100%" rounded="xl" />
                    <Skeleton h="100px" w="100%" rounded="xl" />
                  </Flex>
                ) : (
                  <>
                    <Card.Root rounded="xl">
                      <Card.Body p={4} pb={3}>
                        <Flex justify="space-between" gap={4}>
                          <Flex flexDir="column" gap={1} flexGrow={1} minW={0}>
                            <Flex align="center" gap={2}>
                              <Flex align="center" gap={2} minW={0}>
                                <UserAvatar
                                  id={userId}
                                  displayName={user?.displayName}
                                  avatarUrl={user?.avatarUrl}
                                  identifier={user?.identifier}
                                />
                                <Heading size="lg" truncate maxW="100%">
                                  {userName}
                                </Heading>
                              </Flex>
                              {isOnline && (
                                <Tooltip content="The user is currently active">
                                  <Status value="success" color="fg" gap={1.5} pos="relative" zIndex="5" />
                                </Tooltip>
                              )}
                            </Flex>
                            <Box flexGrow={1} />
                            <HStack color="fg.muted" textStyle="sm">
                              <Flex gap={1.5} align="center">
                                <CountryFlag countryCode={countryCode ?? ''} />
                                {COUNTRIES[countryCode as keyof typeof COUNTRIES] ?? 'Unknown'}
                              </Flex>
                            </HStack>
                          </Flex>
                          <Flex flexDir="column" gap={1.5} align="flex-end">
                            {deviceData?.clientName && (
                              <Flex align="center" gap={1.5}>
                                <BrowserIcon browserName={deviceData?.clientName ?? ''} />
                                <Text textStyle="sm" fontWeight="medium" truncate>
                                  {deviceData?.clientName}{' '}
                                  <Span hideBelow="md" opacity={0.5}>
                                    {deviceData?.clientVersion}
                                  </Span>
                                </Text>
                              </Flex>
                            )}
                            {deviceData?.osName && (
                              <Flex align="center" gap={1.5}>
                                <OsIcon osName={deviceData?.osName ?? ''} />
                                <Text textStyle="sm" fontWeight="medium" truncate>
                                  {deviceData?.osName}{' '}
                                  <Span hideBelow="md" opacity={0.5}>
                                    {deviceData?.osVersion}
                                  </Span>
                                </Text>
                              </Flex>
                            )}
                            {deviceData?.deviceType && (
                              <Flex align="center" gap={1.5}>
                                <DeviceIcon deviceType={deviceData?.deviceType ?? ''} />
                                <Text textStyle="sm" fontWeight="medium" truncate>
                                  {deviceData?.deviceType}
                                </Text>
                              </Flex>
                            )}
                          </Flex>
                        </Flex>
                      </Card.Body>
                    </Card.Root>
                    {user ? (
                      <Card.Root rounded="xl">
                        <Card.Header>
                          <Flex align="center" justify="space-between">
                            <Flex align="center" gap={2}>
                              <CardIcon>
                                <TbEye />
                              </CardIcon>
                              <Text fontWeight="semibold">First seen</Text>
                            </Flex>
                            <Text textStyle="sm" opacity={0.5} fontWeight="semibold">
                              {dateTimeFormatter.formatDateTime(user.firstSeenAt)}
                            </Text>
                          </Flex>
                        </Card.Header>
                        <Card.Body p={4} pb={3}>
                          <SimpleGrid textStyle="sm" columns={2} gap={2.5} gridTemplateColumns="1fr 3fr">
                            <Box fontWeight="semibold" opacity={0.6}>
                              URL
                            </Box>
                            <Tooltip
                              content={
                                '' +
                                user.origin +
                                user.pathname +
                                formatQueryParams(user.queryParams ?? {}) +
                                user.urlHash
                              }
                              positioning={{ placement: 'bottom-end' }}
                            >
                              <Box fontWeight="medium" textAlign="right" truncate>
                                {user.origin}
                                {user.pathname}
                                {formatQueryParams(user.queryParams ?? {})}
                                {user.urlHash}
                              </Box>
                            </Tooltip>
                            {user.referrer && (
                              <>
                                <Box fontWeight="semibold" opacity={0.6}>
                                  Referrer
                                </Box>
                                <Flex justify="flex-end">
                                  <Tooltip
                                    content={user.referrer ? `Referred via ${user.referrerUrl}` : `Direct page visit.`}
                                  >
                                    <Flex align="center" gap={1} truncate>
                                      <Flex
                                        align="center"
                                        justify="center"
                                        flexShrink={0}
                                        boxSize="18px"
                                        bg="gray.subtle"
                                        rounded="4px"
                                        color="gray.fg"
                                        overflow="hidden"
                                      >
                                        {user.referrer && user.referrerUrl ? (
                                          <LoadingImage
                                            src={getFaviconUrl(user.referrerUrl)}
                                            alt={user.referrer + ' Favicon'}
                                            boxSize="16px"
                                          />
                                        ) : (
                                          <TbDirectionSign />
                                        )}
                                      </Flex>
                                      {user.referrer || 'Direct'}
                                    </Flex>
                                  </Tooltip>
                                </Flex>
                              </>
                            )}
                            {user.utmSource && (
                              <>
                                <Box fontWeight="semibold" opacity={0.6}>
                                  UTM Source
                                </Box>
                                <Box fontWeight="medium" textAlign="right" truncate>
                                  {user.utmSource}
                                </Box>
                              </>
                            )}
                            {user.utmMedium && (
                              <>
                                <Box fontWeight="semibold" opacity={0.6}>
                                  UTM Medium
                                </Box>
                                <Box fontWeight="medium" textAlign="right" truncate>
                                  {user.utmMedium}
                                </Box>
                              </>
                            )}
                            {user.utmCampaign && (
                              <>
                                <Box fontWeight="semibold" opacity={0.6}>
                                  UTM Campaign
                                </Box>
                                <Box fontWeight="medium" textAlign="right" truncate>
                                  {user.utmCampaign}
                                </Box>
                              </>
                            )}
                            {user.utmTerm && (
                              <>
                                <Box fontWeight="semibold" opacity={0.6}>
                                  UTM Term
                                </Box>
                                <Box fontWeight="medium" textAlign="right" truncate>
                                  {user.utmTerm}
                                </Box>
                              </>
                            )}
                            {user.utmContent && (
                              <>
                                <Box fontWeight="semibold" opacity={0.6}>
                                  UTM Content
                                </Box>
                                <Box fontWeight="medium" textAlign="right" truncate>
                                  {user.utmContent}
                                </Box>
                              </>
                            )}
                          </SimpleGrid>
                        </Card.Body>
                      </Card.Root>
                    ) : (
                      <Card.Root rounded="xl">
                        <Card.Body>
                          <Flex justify="center" fontSize="5xl">
                            <Flex
                              align="center"
                              justify="center"
                              boxSize="70px"
                              rounded="full"
                              border="3px dashed"
                              borderColor="gray.emphasized"
                              p={2}
                            >
                              <Icon asChild opacity={0.7}>
                                <TbUserQuestion />
                              </Icon>
                            </Flex>
                          </Flex>
                          <Alert.Root status="info" variant="surface" mt={5} p={2}>
                            <Alert.Content>
                              <Alert.Description>
                                <Text>
                                  This is an anonymous user. You can identify authenticated users in your app so
                                  they&apos;ll be tracked across several days.
                                </Text>
                                <Text mt={2}>
                                  It also allows you to attach attributes to them in order to store helpful information
                                  for each of your users.
                                </Text>
                              </Alert.Description>
                            </Alert.Content>
                          </Alert.Root>
                          <Flex justify="center">
                            <Button mt={4} asChild _hover={{ textDecoration: 'none' }}>
                              <ChakraLink
                                href="https://vemetric.com/docs/product-analytics/user-identification"
                                target="_blank"
                              >
                                Start identifying users
                              </ChakraLink>
                            </Button>
                          </Flex>
                        </Card.Body>
                      </Card.Root>
                    )}
                    {user?.customData && Object.entries(user.customData).length > 0 && (
                      <Card.Root rounded="xl">
                        <Card.Header>
                          <Flex align="center" gap={2}>
                            <CardIcon>
                              <TbDatabaseSearch />
                            </CardIcon>
                            <Text fontWeight="semibold">Attributes</Text>
                          </Flex>
                        </Card.Header>
                        <Card.Body p={4} pb={3}>
                          <SimpleGrid textStyle="sm" columns={2} gap={2.5} gridTemplateColumns="1fr 3fr">
                            {Object.entries(user.customData)
                              .sort((a, b) => a[0].localeCompare(b[0]))
                              .map(([key, value]) => (
                                <Fragment key={key}>
                                  <Box fontWeight="semibold" opacity={0.6}>
                                    {key}
                                  </Box>
                                  <Box fontWeight="medium" textAlign="right" truncate>
                                    <RenderAttributeValue value={value} />
                                  </Box>
                                </Fragment>
                              ))}
                          </SimpleGrid>
                        </Card.Body>
                      </Card.Root>
                    )}
                    <Card.Root rounded="xl">
                      <Card.Header>
                        <Flex align="center" gap={2}>
                          <CardIcon>
                            <TbActivity />
                          </CardIcon>
                          <Text fontWeight="semibold">Activity</Text>
                        </Flex>
                      </Card.Header>
                      <Card.Body p={4} pb={3}>
                        <ActivityHeatmap projectId={projectId} userId={userId} selectedDate={date} />
                      </Card.Body>
                    </Card.Root>
                    <UserFunnelProgress projectId={projectId} userId={userId} />
                  </>
                )}
              </Flex>
            </SimpleBar>
            <Box
              pointerEvents="none"
              pos="absolute"
              top="0"
              left="0"
              h="50px"
              w="100%"
              bg="linear-gradient(to top, transparent 0%, var(--chakra-colors-bg-content) 75%)"
              opacity={topOverlayVisible ? 1 : 0}
              transition="opacity 0.2s ease-out"
            />
            <Box
              pointerEvents="none"
              pos="absolute"
              bottom="0"
              left="0"
              h="50px"
              w="100%"
              bg="linear-gradient(to bottom, transparent 0%, var(--chakra-colors-bg-content) 75%)"
              opacity={bottomOverlayVisible ? 1 : 0}
              transition="opacity 0.2s ease-out"
            />
          </Box>
        </Box>
      </SimpleGrid>
    </FilterContextProvider>
  );
}
