import { Box, Flex, Skeleton, Tag, Text } from '@chakra-ui/react';
import { TbDirectionSign } from 'react-icons/tb';
import { LoadingImage } from '@/components/loading-image';
import { Tooltip } from '@/components/ui/tooltip';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { getFaviconUrl } from '@/utils/favicon';
import type { EventData, SessionData } from '@/utils/trpc';
import { DateSeparator } from './date-separator';
import { EventCard } from './event-card';

interface Props {
  index: number;
  session: (SessionData & { date: string }) | undefined;
  showOnlineTag: boolean;
  isLastSession: boolean;
  renderDate: boolean;
  lastDateWasNull: boolean;
  isNextEventSameSession: boolean;
  isPreviousData: boolean;
  events: EventData[];
}

export const SessionGroup = (props: Props) => {
  const {
    index,
    session,
    showOnlineTag,
    isLastSession,
    renderDate,
    lastDateWasNull,
    isNextEventSameSession,
    isPreviousData,
    events,
  } = props;
  const nowDate = dateTimeFormatter.formatDate(new Date());
  const isCompleteSession = !isLastSession || !isNextEventSameSession;

  let lastPageViewDate: string | null = null;

  return (
    <>
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
              {showOnlineTag && (
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
                  <Text>Session ended at {dateTimeFormatter.formatDateTime(session?.endedAt ?? '')}</Text>
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
                <EventCard key={event.id} event={event} lastPageViewDate={lastPageViewDate ?? session?.endedAt} />
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
                <Tooltip content={session.referrer ? `Referred via ${session.referrerUrl}` : `Direct page visit.`}>
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
              <Tooltip content={`Session started at ${dateTimeFormatter.formatDateTime(session?.startedAt ?? '')}`}>
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
    </>
  );
};
