import { Box, Flex, Card, Button, Icon, Link as ChakraLink, Spinner } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { AnimatePresence } from 'motion/react';
import { TbActivity, TbArrowDown } from 'react-icons/tb';
import { PageDotBackground } from '@/components/page-dot-background';
import { EventCard, EventCardSkeleton } from '@/components/pages/events/event-card';
import { DateSeparator } from '@/components/pages/user/date-separator';
import { EmptyState } from '@/components/ui/empty-state';
import { Status } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import { EventsPageStoreProvider } from '@/stores/events-page-store';
import { useSetBreadcrumbs, useSetDocsLink } from '@/stores/header-store';
import { trpc } from '@/utils/trpc';

export const Route = createFileRoute('/_layout/p/$projectId/events/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  const {
    data: eventsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.events.list.useInfiniteQuery(
    { projectId },
    {
      keepPreviousData: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 5000,
    },
  );

  const events = eventsData?.pages.flatMap((page) => page.events ?? []) ?? [];

  useSetBreadcrumbs(['Events']);
  useSetDocsLink('https://vemetric.com/docs/product-analytics/tracking-custom-events');

  if (isLoading) {
    return (
      <>
        <PageDotBackground />
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

  if (events.length === 0) {
    return (
      <>
        <PageDotBackground />
        <Box mx="auto" pos="relative" maxW="500px">
          <Card.Root rounded="xl">
            <EmptyState
              icon={<TbActivity />}
              title="No events found"
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
      </>
    );
  }

  return (
    <EventsPageStoreProvider>
      <>
        <PageDotBackground />
        <Box
          pos="sticky"
          top={{ base: '50px', md: '126px', lg: '58px' }}
          left={0}
          right={0}
          mt={-3}
          h={{ base: 5, md: 3 }}
          bg="bg.content"
          w="100%"
          maxW="500px"
          mx="auto"
          zIndex="3"
        />
        <Box pos="fixed" top={{ base: '58px', md: '140px', lg: '70px' }} zIndex="5">
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
        <Flex flexDir="column" gap="6" mx="auto" pos="relative" maxW="500px">
          <Box pos="sticky" top={{ base: '70px', md: '140px', lg: '70px' }} zIndex="4" mb={-5} pb={5}>
            <Box
              pos="absolute"
              left={0}
              right={0}
              top={-3}
              h={3}
              bg="linear-gradient(to top, var(--chakra-colors-bg-content), rgba(255,255,255,0))"
            />
            <DateSeparator>Today</DateSeparator>
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
                  roundedBottom: hasNextPage ? 'none' : 'xl',
                  borderBottomWidth: hasNextPage ? '0px' : '1px',
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
            {hasNextPage && (
              <>
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
              </>
            )}
          </Box>
        </Flex>
      </>
    </EventsPageStoreProvider>
  );
}
