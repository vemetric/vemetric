import type { BoxProps } from '@chakra-ui/react';
import { Box, Text, Flex, Card, SimpleGrid, Span, Icon, LinkOverlay, Skeleton } from '@chakra-ui/react';
import { Link } from '@tanstack/react-router';
import { getEventName } from '@vemetric/common/event';
import { motion } from 'motion/react';
import { Fragment } from 'react';
import { TbBolt, TbChevronRight } from 'react-icons/tb';
import { useSnapshot } from 'valtio';
import { BrowserIcon } from '@/components/browser-icon';
import { CardIcon } from '@/components/card-icon';
import { DeviceIcon } from '@/components/device-icon';
import { EventIcon } from '@/components/event-icon';
import { OsIcon } from '@/components/os-icon';
import { useEventsPageStore } from '@/stores/events-page-store';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { getUserName } from '@/utils/user';
import { UserAvatar } from '../user/user-avatar';

export const EventCardSkeleton = (props: BoxProps) => {
  return (
    <Box pos="relative" {...props}>
      <Box pos="absolute" top="4.5" left="4">
        <CardIcon size="lg">
          <TbBolt />
        </CardIcon>
      </Box>
      <Skeleton rounded="none" h="73px" bg={{ base: 'gray.muted', _dark: 'gray.subtle' }} />
    </Box>
  );
};

interface Props {
  event: {
    id: string;
    projectId: string;
    name: string;
    createdAt: string;
    customData: Record<string, any>;
    clientName?: string;
    clientVersion?: string;
    osName?: string;
    osVersion?: string;
    deviceType?: string;

    userId: string;
    userIdentifier?: string;
    userDisplayName?: string;
  };
  previousEventId?: string;
  nextEventId?: string;
}
export const EventCard = ({ event, previousEventId, nextEventId }: Props) => {
  const state = useEventsPageStore();
  const { eventsOpened } = useSnapshot(state);

  const isOpen = eventsOpened.includes(event.id);
  const isAnyOpen = eventsOpened.length > 0;
  const isPreviousOpen = previousEventId && eventsOpened.includes(previousEventId);
  const isNextOpen = nextEventId && eventsOpened.includes(nextEventId);

  const displayName = getEventName(event.name);

  return (
    <Box
      asChild
      transition="all 0.4s ease-in-out, transform 0s"
      css={
        isOpen
          ? {
              pt: previousEventId ? 3 : 0,
              mb: isNextOpen ? 0 : 3,
              borderBottom: nextEventId || isOpen ? '1px solid' : 'none',
              borderColor: 'gray.emphasized',
              roundedBottom: 'xl',
              '& > div': { rounded: 'xl!important' },
            }
          : {}
      }
    >
      <motion.div
        layout
        layoutId={event.id}
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: isOpen ? 1 : isAnyOpen ? 0.65 : 1 }}
        transition={{ duration: 0.4, ease: 'easeInOut', bounce: 0 }}
      >
        <Card.Root
          key={event.name}
          overflow="hidden"
          data-event-card
          rounded="xl"
          bg="bg.card"
          transition="all 0.4s ease-in-out"
          borderBottomWidth={!isOpen && isNextOpen ? '1px!important' : undefined}
          roundedBottom={!isOpen && isNextOpen ? 'xl!important' : undefined}
          roundedTop={!isOpen && isPreviousOpen ? 'xl!important' : 'none'}
        >
          <Card.Header
            as="button"
            cursor="pointer"
            px={4.5}
            py={4}
            onClick={() => {
              if (isOpen) {
                state.eventsOpened = state.eventsOpened.filter((id) => id !== event.id);
              } else {
                state.eventsOpened = [...state.eventsOpened, event.id];
              }
            }}
            bg={isOpen ? 'gray.subtle/20' : 'transparent'}
            _hover={{ bg: 'gray.subtle' }}
          >
            <Flex align="center" justify="space-between" gap={2} w="100%">
              <Flex align="center" gap={2.5} minWidth={0}>
                <CardIcon size="lg">
                  <EventIcon name={event.name} />
                </CardIcon>
                <Flex flexDir="column" gap={1} minW={0} flexGrow={1} align="flex-start">
                  <Text textStyle="sm" fontWeight="semibold" truncate>
                    {displayName}
                  </Text>
                  <Flex align="center" gap={1.5}>
                    <Flex align="center" gap={1}>
                      <UserAvatar
                        id={event.userId}
                        displayName={event.userDisplayName}
                        identifier={event.userIdentifier}
                        boxSize="10px"
                        rounded="full"
                        color="transparent"
                      />
                      <Text textStyle="xs">{getUserName(event.userDisplayName, event.userIdentifier)}</Text>
                    </Flex>
                    <Box boxSize="3px" bg="gray.emphasized" rounded="full" />
                    <Text textStyle="xs" color="fg.muted">
                      {dateTimeFormatter.formatTime(event.createdAt, true)}
                    </Text>
                  </Flex>
                </Flex>
              </Flex>
              <Icon
                as={TbChevronRight}
                fontSize="lg"
                transform={isOpen ? 'rotate(90deg)' : 'rotate(0deg)'}
                transition="transform 0.3s ease-in-out"
              />
            </Flex>
          </Card.Header>
          <Card.Body asChild p={0} flex="auto" overflow="hidden">
            <motion.div initial={{ height: 0 }} animate={{ height: isOpen ? 'auto' : 0 }}>
              <Box p={4} pb={3} borderTop="1px dashed" borderColor="gray.emphasized/70">
                <SimpleGrid textStyle="sm" columns={2} gap={2.5} gridTemplateColumns="1fr 3fr">
                  <Box fontWeight="semibold" opacity={0.6}>
                    User
                  </Box>
                  <Flex align="center" justify="flex-end" gap={2}>
                    <Flex align="center" gap={1.5} pos="relative" fontWeight="semibold" className="group">
                      <UserAvatar
                        id={event.userId}
                        displayName={event.userDisplayName}
                        identifier={event.userIdentifier}
                        boxSize="20px"
                        fontSize="xs"
                      />
                      <LinkOverlay
                        asChild
                        truncate
                        _before={{ zIndex: 4 }}
                        _groupHover={{
                          textDecoration: 'underline',
                          textUnderlineOffset: '4px',
                          textDecorationColor: 'gray.emphasized',
                        }}
                      >
                        <Link
                          to="/p/$projectId/users/$userId"
                          params={{ projectId: event.projectId, userId: event.userId }}
                        >
                          {getUserName(event.userDisplayName, event.userIdentifier)}
                        </Link>
                      </LinkOverlay>
                      <Icon
                        as={TbChevronRight}
                        ml="-0.5"
                        mr="-1"
                        transition="transform 0.2s ease-in-out"
                        _groupHover={{ transform: 'translateX(1.5px)' }}
                      />
                    </Flex>
                  </Flex>
                  <Box fontWeight="semibold" opacity={0.6}>
                    Date
                  </Box>
                  <Box fontWeight="medium" textAlign="right" truncate>
                    {dateTimeFormatter.formatDateTime(event.createdAt)}
                  </Box>
                  {Object.entries(event.customData)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([key, value]) => (
                      <Fragment key={key}>
                        <Box fontWeight="semibold" opacity={0.6}>
                          {key}
                        </Box>
                        <Box fontWeight="medium" textAlign="right" truncate>
                          {typeof value === 'boolean' ? JSON.stringify(value) : (value as any)}
                        </Box>
                      </Fragment>
                    ))}
                </SimpleGrid>
              </Box>
              <Flex
                gap={3}
                align="center"
                justify="space-between"
                opacity={0.8}
                mt={1}
                borderTop="1px solid"
                borderColor="gray.emphasized"
                pt={3}
                pb={2}
                px={4}
                bg="gray.subtle/50"
                flexWrap="wrap"
              >
                {event.clientName && (
                  <Flex align="center" gap={1.5}>
                    <BrowserIcon browserName={event.clientName ?? ''} />
                    <Text textStyle="sm" fontWeight="medium" truncate>
                      {event.clientName} <Span opacity={0.5}>{event.clientVersion}</Span>
                    </Text>
                  </Flex>
                )}
                {event.osName && (
                  <Flex align="center" gap={1.5}>
                    <OsIcon osName={event.osName ?? ''} />
                    <Text textStyle="sm" fontWeight="medium" truncate>
                      {event.osName} <Span opacity={0.5}>{event.osVersion}</Span>
                    </Text>
                  </Flex>
                )}
                {event.deviceType && (
                  <Flex align="center" gap={1.5}>
                    <DeviceIcon deviceType={event.deviceType ?? ''} />
                    <Text textStyle="sm" fontWeight="medium" truncate>
                      {event.deviceType}
                    </Text>
                  </Flex>
                )}
              </Flex>
            </motion.div>
          </Card.Body>
        </Card.Root>
      </motion.div>
    </Box>
  );
};
