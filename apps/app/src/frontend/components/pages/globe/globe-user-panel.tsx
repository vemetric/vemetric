import { Box, Button, Flex, HStack, Icon, Skeleton, Span, Spinner, Text } from '@chakra-ui/react';
import { COUNTRIES } from '@vemetric/common/countries';
import { useEffect, useRef } from 'react';
import { TbClock, TbUserOff, TbUserSquareRounded } from 'react-icons/tb';
import { CountryFlag } from '@/components/country-flag';
import { NumberCounter } from '@/components/number-counter';
import { CloseButton } from '@/components/ui/close-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import type { GlobePanelUser } from '@/utils/trpc';
import { getUserName } from '@/utils/user';
import { UserAvatar } from '../user/user-avatar';

interface Props {
  users: GlobePanelUser[];
  totalUsers?: number;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  usersCurrentPage: number;
  isUserPanelOpen: boolean;
  setUserPanelOpen: (isOpen: boolean) => void;
}

export const GlobeUserPanel = ({
  users,
  totalUsers,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  usersCurrentPage,
  isUserPanelOpen,
  setUserPanelOpen,
}: Props) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const showEmptyState = (totalUsers ?? 0) === 0;

  useEffect(() => {
    const loadMoreElement = loadMoreRef.current;
    if (!isUserPanelOpen || !loadMoreElement || !hasNextPage) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
        observer.disconnect();
        fetchNextPage();
      }
    });
    observer.observe(loadMoreElement);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isUserPanelOpen, usersCurrentPage]);

  const userCounter =
    typeof totalUsers === 'number' ? (
      <NumberCounter value={totalUsers} />
    ) : (
      <Skeleton display="inline-block" width="16px" height="14px" verticalAlign="middle" />
    );

  return (
    <Box pos="absolute" bottom={3} left={3} zIndex="2" display="flex">
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
          <Box px={3} py={2.5} flexGrow={1} overflowY="auto">
            {showEmptyState ? (
              <Flex h="150px" align="center" justify="center">
                <EmptyState
                  icon={<Icon as={TbUserOff} />}
                  title="No active users"
                  description="No users were active in the selected time range."
                />
              </Flex>
            ) : (
              <Flex flexDir="column" gap={3}>
                {users.map((user) => (
                  <Flex key={user.id} justify="space-between" align="center" gap={3}>
                    <Flex align="center" gap={3}>
                      <UserAvatar
                        enableBlink
                        id={user.id}
                        identifier={user.identifier}
                        displayName={user.displayName}
                        avatarUrl={user.avatarUrl}
                      />
                      <Box lineHeight="shorter">
                        <Text fontWeight="medium">{getUserName(user.displayName, user.identifier)}</Text>
                        <Flex gap={1.5} color="fg.muted" align="center">
                          <CountryFlag countryCode={user.countryCode} />
                          <Text fontSize="sm" color="text.muted">
                            {COUNTRIES[user.countryCode as keyof typeof COUNTRIES] ?? 'Unknown'}
                          </Text>
                        </Flex>
                      </Box>
                    </Flex>
                    <Tooltip content={`Last seen at ${dateTimeFormatter.formatDateTime(user.lastSeenAt)}`}>
                      <HStack pos="relative" zIndex="5" gap={{ base: 2, md: 1 }} color="fg.muted">
                        <Icon>
                          <TbClock />
                        </Icon>
                        <Text textStyle="sm">
                          {dateTimeFormatter.formatDistanceNow(user.lastSeenAt, true)} <Span hideBelow="md">ago</Span>
                        </Text>
                      </HStack>
                    </Tooltip>
                  </Flex>
                ))}
                {hasNextPage && (
                  <Flex ref={loadMoreRef} justify="center" py={2}>
                    {isFetchingNextPage && <Spinner size="xs" borderWidth="1.5px" />}
                  </Flex>
                )}
              </Flex>
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
    </Box>
  );
};
