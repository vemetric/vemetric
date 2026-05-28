import { Box, Button, Card, Flex, Heading, HStack, Icon, Spinner, Text } from '@chakra-ui/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { TbClock } from 'react-icons/tb';
import { LocationLabel } from '@/components/location-label';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import type { GlobeBucketUser } from '@/utils/trpc';
import { GlobeMarkerCardIdentity } from './globe-marker-card-identity';
import { GlobeMultiUserAvatar } from './globe-multi-user-avatar';
import { UserAvatar } from '../user/user-avatar';

const USER_ROW_HEIGHT = 52;
const USER_ROW_CONTENT_HEIGHT = 48;
const MAX_LIST_HEIGHT = 250;

interface Props {
  users: Array<GlobeBucketUser>;
  userCount: number;
  initialScrollOffset: number;
  onScrollOffsetChange: (scrollOffset: number) => void;
  onSelectUser: (userId: string) => void;
  isBucketUsersLoading: boolean;
}

export const GlobeMarkerUserList = (props: Props) => {
  const { users, userCount, initialScrollOffset, onScrollOffsetChange, onSelectUser, isBucketUsersLoading } = props;
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const userWithLocation = users.find((user) => user.city && user.city.toLowerCase() !== 'unknown') ?? users[0];
  const rowVirtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => USER_ROW_HEIGHT,
    getItemKey: (index) => users[index]?.id ?? index,
    initialOffset: initialScrollOffset,
    overscan: 6,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  if (users.length === 0) {
    return null;
  }

  return (
    <>
      <Card.Header pr={10} pb={3} pos="relative" zIndex={1}>
        <Flex align="center" gap={2}>
          <GlobeMultiUserAvatar users={users} />
          <Box minW={0}>
            <Heading size="sm" display="flex" alignItems="center" gap={2} truncate>
              {userCount} {userCount === 1 ? 'User' : 'Users'} near{' '}
              <LocationLabel
                as="span"
                display="inline-flex"
                countryCode={userWithLocation.countryCode}
                city={userWithLocation.city}
              />
            </Heading>
            <Text textStyle="xs" color="fg.muted">
              Select a user to inspect their details.
            </Text>
          </Box>
        </Flex>
      </Card.Header>
      <Card.Body py={0} px={1} pr={users.length > 4 ? '12px' : 1} overflow="visible" pos="relative" zIndex={2}>
        {isBucketUsersLoading ? (
          <Flex h="72px" align="center" justify="center">
            <Spinner size="sm" borderWidth="2px" />
          </Flex>
        ) : (
          <Box
            ref={scrollParentRef}
            h={`${Math.min(rowVirtualizer.getTotalSize(), MAX_LIST_HEIGHT)}px`}
            maxH={`${MAX_LIST_HEIGHT}px`}
            overflowY="auto"
            pos="relative"
            onScroll={(event) => {
              onScrollOffsetChange(event.currentTarget.scrollTop);
            }}
          >
            <Box h={`${rowVirtualizer.getTotalSize()}px`} pos="relative">
              {virtualRows.map((virtualRow) => {
                const user = users[virtualRow.index];

                return (
                  <Box
                    key={virtualRow.key}
                    pos="absolute"
                    top={0}
                    left={0}
                    w="full"
                    h={`${USER_ROW_CONTENT_HEIGHT}px`}
                    transform={`translateY(${virtualRow.start}px)`}
                  >
                    <Button
                      variant="ghost"
                      h={`${USER_ROW_CONTENT_HEIGHT}px`}
                      w="full"
                      justifyContent="flex-start"
                      px={2}
                      py={1.5}
                      onClick={() => onSelectUser(user.id)}
                    >
                      <Flex align="center" justify="space-between" gap={3} w="full" minW={0}>
                        <Flex align="center" gap={0.5} minW={0}>
                          <Box pt={1} pr={2.5}>
                            <UserAvatar
                              id={user.id}
                              identifier={user.identifier}
                              displayName={user.displayName}
                              avatarUrl={user.avatarUrl}
                              boxSize="28px"
                            />
                          </Box>
                          <GlobeMarkerCardIdentity user={user} isOnline={user.isOnline} />
                        </Flex>
                        <HStack flexShrink={0} gap={1} color="fg.muted">
                          <Icon as={TbClock} />
                          <Text textStyle="xs">{dateTimeFormatter.formatDistanceNow(user.lastSeenAt, true)}</Text>
                        </HStack>
                      </Flex>
                    </Button>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Card.Body>
    </>
  );
};
