import { Box, Text, Flex, Card, SimpleGrid, useBreakpointValue, Span } from '@chakra-ui/react';
import { motion } from 'motion/react';
import { Fragment, useState } from 'react';
import { BrowserIcon } from '@/components/browser-icon';
import { DeviceIcon } from '@/components/device-icon';
import { EventIconButton } from '@/components/event-icon-button';
import { OsIcon } from '@/components/os-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { dateTimeFormatter } from '@/utils/date-time-formatter';

interface Props {
  event: {
    id: string;
    name: string;
    origin?: string;
    pathname?: string;
    urlHash?: string;
    createdAt: string;
    customData: Record<string, unknown>;
    clientName?: string;
    clientVersion?: string;
    osName?: string;
    osVersion?: string;
    deviceType?: string;
  };
  lastPageViewDate?: string;
}

export const EventCard = ({ event, lastPageViewDate }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const isPageView = event.name === '$$pageView';

  let tooltipContent = 'Custom Event';
  if (isPageView) {
    tooltipContent = `Pageview: ${event.origin}${event.pathname}${event.urlHash}`;
  } else if (event.name === '$$outboundLink') {
    tooltipContent = 'Outbound Link Click';
  }

  let displayName = event.name;
  if (isPageView) {
    displayName = event.pathname ? event.pathname + event.urlHash : 'Page View';
  } else if (event.name === '$$outboundLink') {
    displayName = (event.customData?.href as string) ?? 'Outbound Link';
  }

  return (
    <Tooltip
      disabled={!isDesktop}
      content={tooltipContent}
      closeOnClick={false}
      closeOnPointerDown={false}
      positioning={{ placement: 'bottom-start', gutter: 3 }}
      contentProps={{ whiteSpace: 'nowrap', truncate: true, maxW: '700px' }}
    >
      <Card.Root key={event.id} overflow="hidden" data-event-card>
        <Card.Header
          as="button"
          cursor="pointer"
          p="3"
          onClick={() => setIsOpen(!isOpen)}
          bg={isOpen ? 'gray.subtle/20' : 'transparent'}
          _hover={{ bg: 'gray.subtle' }}
        >
          <Flex align="center" justify="space-between" gap={2} w="100%">
            <Flex align="center" gap={2.5} minWidth={0}>
              <EventIconButton name={event.name} />
              <Text textStyle="sm" fontWeight="semibold" truncate>
                {displayName}
              </Text>
            </Flex>
            {isPageView && lastPageViewDate && event.createdAt !== lastPageViewDate && (
              <Tooltip
                content={`Spent ${dateTimeFormatter.formatDistance(lastPageViewDate, event.createdAt)} on this page`}
              >
                <Text textStyle="sm" opacity={0.4} fontWeight="semibold" flexShrink={0}>
                  {dateTimeFormatter.formatDistance(lastPageViewDate, event.createdAt, true)}
                </Text>
              </Tooltip>
            )}
          </Flex>
        </Card.Header>
        <Card.Body asChild p={0} flex="auto" overflow="hidden">
          <motion.div initial={{ height: 0 }} animate={{ height: isOpen ? 'auto' : 0 }}>
            <Box p={4} pb={3} borderTop="1px dashed" borderColor="gray.emphasized/70">
              <SimpleGrid textStyle="sm" columns={2} gap={2.5} gridTemplateColumns="1fr 3fr">
                <Box fontWeight="semibold" opacity={0.6}>
                  Date
                </Box>
                <Box fontWeight="medium" textAlign="right" truncate>
                  {dateTimeFormatter.formatTime(event.createdAt, true)}
                </Box>
                {isPageView && (
                  <Fragment>
                    <Box fontWeight="semibold" opacity={0.6}>
                      URL
                    </Box>
                    <Box fontWeight="medium" textAlign="right" truncate>
                      {event.origin}
                      {event.pathname}
                      {event.urlHash}
                    </Box>
                  </Fragment>
                )}
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
    </Tooltip>
  );
};
