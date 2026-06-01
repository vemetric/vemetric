import { Box, Button, Flex, HStack, Icon, Skeleton, Span, Spinner, Text } from '@chakra-ui/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { COUNTRIES } from '@vemetric/common/countries';
import { useEffect, useRef, useState } from 'react';
import { TbClock, TbUserOff, TbUserSquareRounded } from 'react-icons/tb';
import { CountryFlag } from '@/components/country-flag';
import { NumberCounter } from '@/components/number-counter';
import { CloseButton } from '@/components/ui/close-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Status } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import type { GlobeJoinedUser, GlobePanelUser } from '@/utils/trpc';
import { getUserName } from '@/utils/user';
import { GlobeJoinNotifications } from './globe-join-notifications';
import { UserAvatar } from '../user/user-avatar';

const USER_ROW_HEIGHT = 54;
const LOADER_ROW_HEIGHT = 32;

interface Props {
  projectId: string;
  timespan: TimeSpan;
  startDate?: string;
  endDate?: string;
  isInitialized: boolean;
  users: GlobePanelUser[];
  totalUsers?: number;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  usersCurrentPage: number;
  isUserPanelOpen: boolean;
  setUserPanelOpen: (isOpen: boolean) => void;
  onSelectUser: (user: GlobePanelUser | GlobeJoinedUser) => void;
}

export const GlobeUserPanel = (props: Props) => {
  const {
    projectId,
    timespan,
    startDate,
    endDate,
    isInitialized,
    users,
    totalUsers,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    usersCurrentPage,
    isUserPanelOpen,
    setUserPanelOpen,
    onSelectUser,
  } = props;

  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const [loadMoreElement, setLoadMoreElement] = useState<HTMLDivElement | null>(null);
  const showEmptyState = (totalUsers ?? 0) === 0;
  const rowCount = showEmptyState ? 0 : users.length + (hasNextPage ? 1 : 0);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (index) => (index >= users.length ? LOADER_ROW_HEIGHT : USER_ROW_HEIGHT),
    getItemKey: (index) => users[index]?.id ?? 'loader',
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (!isUserPanelOpen || !loadMoreElement || !hasNextPage) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
        observer.disconnect();
        fetchNextPage();
      }
    });
    observer.observe(loadMoreElement);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isUserPanelOpen, loadMoreElement, usersCurrentPage]);

  const userCounter =
    typeof totalUsers === 'number' ? (
      <NumberCounter value={totalUsers} />
    ) : (
      <Skeleton display="inline-block" width="16px" height="14px" verticalAlign="middle" />
    );

  return (
    <Box pos="absolute" bottom={3} left={3} zIndex="2" display="flex" flexDir="column">
      <Box
        pos="relative"
        pointerEvents="none"
        opacity={isUserPanelOpen ? 0 : 1}
        pl={0.5}
        transition="all 0.3s ease-in-out"
        inert={isUserPanelOpen ? true : false}
      >
        <GlobeJoinNotifications
          projectId={projectId}
          timespan={timespan}
          startDate={startDate}
          endDate={endDate}
          isInitialized={isInitialized}
          onSelectUser={onSelectUser}
        />
      </Box>
      <Flex>
        <Box pos="relative">
          <Flex
            flexDir="column"
            pos="absolute"
            left="0"
            bottom="0"
            rounded="2xl"
            shadow="0 0 0px 1px var(--shadow-color)"
            shadowColor="gray.emphasized"
            bg="bg.card/90"
            backdropFilter="blur(15px)"
            width={isUserPanelOpen ? '500px' : '90px'}
            height="auto"
            maxH={isUserPanelOpen ? '500px' : '32px'}
            pointerEvents={isUserPanelOpen ? 'auto' : 'none'}
            overflow="hidden"
            transition="all 0.3s ease-in-out"
            css={{
              '& > *': {
                opacity: isUserPanelOpen ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out',
              },
            }}
            inert={isUserPanelOpen ? false : true}
          >
            <Flex
              w="full"
              align="center"
              justify="space-between"
              borderBottom="1px solid"
              borderColor="gray.emphasized"
              bg="bg.card"
            >
              <Flex align="center" gap={1.5} px={3} py={2}>
                <TbUserSquareRounded />
                <Span fontSize="sm">Users ({userCounter})</Span>
              </Flex>
              <CloseButton
                ref={closeButtonRef}
                size="xs"
                rounded="none"
                roundedTopRight="xl"
                roundedBottomLeft="xl"
                py={4.5}
                onClick={() => {
                  setUserPanelOpen(false);
                  setTimeout(() => {
                    buttonRef.current?.focus();
                  });
                }}
              />
            </Flex>
            <Box ref={scrollParentRef} px={3} flexGrow={1} overflowY="auto">
              {showEmptyState ? (
                <Flex h="150px" align="center" justify="center">
                  <EmptyState
                    icon={<Icon as={TbUserOff} />}
                    title="No active users"
                    description="No users were active in the selected time range."
                  />
                </Flex>
              ) : (
                <Box h={`${rowVirtualizer.getTotalSize()}px`} pos="relative">
                  {virtualRows.map((virtualRow) => {
                    const user = users[virtualRow.index];

                    if (!user) {
                      return (
                        <Flex
                          key={virtualRow.key}
                          ref={setLoadMoreElement}
                          pos="absolute"
                          top={0}
                          left={0}
                          w="full"
                          h={`${LOADER_ROW_HEIGHT}px`}
                          justify="center"
                          align="center"
                          transform={`translateY(${virtualRow.start}px)`}
                        >
                          {isFetchingNextPage && <Spinner size="xs" borderWidth="1.5px" />}
                        </Flex>
                      );
                    }

                    return (
                      <Button
                        key={virtualRow.key}
                        variant="ghost"
                        pos="absolute"
                        top={0}
                        left={0}
                        w="full"
                        h={`${USER_ROW_HEIGHT}px`}
                        transform={`translateY(${virtualRow.start}px)`}
                        justifyContent="space-between"
                        gap={3}
                        px={2}
                        py={1.5}
                        onClick={() => onSelectUser(user)}
                      >
                        <Flex align="center" gap={3} minW={0}>
                          <UserAvatar
                            enableBlink
                            id={user.id}
                            identifier={user.identifier}
                            displayName={user.displayName}
                            avatarUrl={user.avatarUrl}
                          />
                          <Box lineHeight="shorter" minW={0} textAlign="left">
                            <Flex align="center" gap={1.5}>
                              <Text fontWeight="medium" truncate>
                                {getUserName(user.displayName, user.identifier)}
                              </Text>
                              {user.isOnline && (
                                <Tooltip content="The user is currently active">
                                  <Status value="success" color="fg" gap={1.5} pos="relative" flexShrink={0} />
                                </Tooltip>
                              )}
                            </Flex>
                            <Flex gap={1.5} color="fg.muted" align="center">
                              <CountryFlag countryCode={user.countryCode} />
                              <Text fontSize="sm" color="text.muted" truncate>
                                {COUNTRIES[user.countryCode as keyof typeof COUNTRIES] ?? 'Unknown'}
                              </Text>
                            </Flex>
                          </Box>
                        </Flex>
                        <Tooltip content={`Last seen at ${dateTimeFormatter.formatDateTime(user.lastSeenAt)}`}>
                          <HStack flexShrink={0} pos="relative" zIndex="5" gap={{ base: 2, md: 1 }} color="fg.muted">
                            <Icon>
                              <TbClock />
                            </Icon>
                            <Text textStyle="sm">
                              {dateTimeFormatter.formatDistanceNow(user.lastSeenAt, true)}{' '}
                              <Span hideBelow="md">ago</Span>
                            </Text>
                          </HStack>
                        </Tooltip>
                      </Button>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Flex>
        </Box>
        <Button
          ref={buttonRef}
          pos="relative"
          variant="surface"
          size="xs"
          rounded="full"
          pointerEvents={isUserPanelOpen ? 'none' : 'auto'}
          opacity={isUserPanelOpen ? 0 : 1}
          transition="opacity 0.3s ease-in-out"
          transitionDelay={isUserPanelOpen ? '0s' : '0.15s'}
          tabIndex={isUserPanelOpen ? -1 : 0}
          onClick={() => {
            setUserPanelOpen(true);
            setTimeout(() => {
              closeButtonRef.current?.focus();
            });
          }}
        >
          <TbUserSquareRounded /> <span>Users ({userCounter})</span>
        </Button>
      </Flex>
    </Box>
  );
};
