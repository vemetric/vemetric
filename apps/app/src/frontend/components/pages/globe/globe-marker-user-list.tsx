import { Box, Button, Card, Flex, Heading, HStack, Icon, Text } from '@chakra-ui/react';
import { TbClock } from 'react-icons/tb';
import { LocationLabel } from '@/components/location-label';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import type { GlobeBucketUser } from '@/utils/trpc';
import { GlobeMarkerCardIdentity } from './globe-marker-card-identity';
import { GlobeMultiUserAvatar } from './globe-multi-user-avatar';
import { GlobeSingleUserAvatar } from './globe-single-user-avatar';

interface Props {
  users: Array<GlobeBucketUser>;
  userCount: number;
  allowOverflow?: boolean;
  onSelectUser: (userId: string) => void;
}

export const GlobeMarkerUserList = (props: Props) => {
  const { users, userCount, allowOverflow = false, onSelectUser } = props;
  const userWithLocation = users.find((user) => user.city && user.city.toLowerCase() !== 'unknown') ?? users[0];

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
      <Card.Body
        py={0}
        px={1}
        pr={allowOverflow && users.length > 4 ? '12px' : 1}
        overflow="visible"
        pos="relative"
        zIndex={2}
      >
        <Flex flexDir="column" gap={1} maxH="250px" overflowY={allowOverflow ? 'visible' : 'auto'}>
          {users.map((user) => (
            <Button
              key={user.id}
              variant="ghost"
              h="auto"
              justifyContent="flex-start"
              px={2}
              py={1.5}
              onClick={() => onSelectUser(user.id)}
              _last={{ mb: 1 }}
            >
              <Flex align="center" justify="space-between" gap={3} w="full" minW={0}>
                <Flex align="center" gap={0.5} minW={0}>
                  <Box pt={1} pr={2.5}>
                    <GlobeSingleUserAvatar user={user} boxSize="28px" />
                  </Box>
                  <GlobeMarkerCardIdentity user={user} isOnline={user.isOnline} />
                </Flex>
                <HStack flexShrink={0} gap={1} color="fg.muted">
                  <Icon as={TbClock} />
                  <Text textStyle="xs">{dateTimeFormatter.formatDistanceNow(user.lastSeenAt, true)}</Text>
                </HStack>
              </Flex>
            </Button>
          ))}
        </Flex>
      </Card.Body>
    </>
  );
};
