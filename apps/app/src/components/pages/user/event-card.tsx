import { Box, Text, Flex, Card, SimpleGrid, useBreakpointValue, Span, Tag, Grid } from '@chakra-ui/react';
import { isEntityUnknown } from '@vemetric/common/event';
import { motion } from 'motion/react';
import { Fragment, useState } from 'react';
import { BrowserIcon } from '@/components/browser-icon';
import { DeviceIcon } from '@/components/device-icon';
import { EventIconButton } from '@/components/event-icon-button';
import { OsIcon } from '@/components/os-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { formatQueryParams } from '@/utils/url';
import { RenderAttributeValue } from './render-attribute-value';

interface Props {
  event: {
    id: string;
    name: string;
    origin?: string;
    pathname?: string;
    urlHash?: string;
    createdAt: string;
    customData: Record<string, any>;
    queryParams?: Record<string, any>;
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
  const isFooterVisible =
    !isEntityUnknown(event.clientName) || !isEntityUnknown(event.osName) || !isEntityUnknown(event.deviceType);

  let tooltipContent = 'Custom Event';
  if (isPageView) {
    tooltipContent = `Pageview: ${event.origin}${event.pathname}${formatQueryParams(event.queryParams ?? {})}${event.urlHash}`;
  } else if (event.name === '$$outboundLink') {
    tooltipContent = 'Outbound Link Click';
  }

  let displayName = event.name;
  if (isPageView) {
    displayName = event.pathname
      ? event.pathname + formatQueryParams(event.queryParams ?? {}) + event.urlHash
      : 'Page View';
  } else if (event.name === '$$outboundLink') {
    displayName = (event.customData?.href as string) ?? 'Outbound Link';
  }

  return (
    <Card.Root key={event.id} overflow="hidden" data-event-card>
      <Tooltip
        disabled={!isDesktop || isOpen}
        content={tooltipContent}
        closeOnClick={false}
        closeOnPointerDown={false}
        positioning={{ placement: 'bottom-start', gutter: 3 }}
        contentProps={{ whiteSpace: 'nowrap', truncate: true, maxW: '700px' }}
      >
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
      </Tooltip>
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
                  {/* URL section */}
                  <Box fontWeight="semibold" opacity={0.6}>
                    URL
                  </Box>
                  <Box fontWeight="medium" textAlign="right" truncate>
                    <RenderAttributeValue
                      value={
                        (event.origin ?? '') +
                        (event.pathname ?? '') +
                        formatQueryParams(event.queryParams ?? {}) +
                        (event.urlHash ?? '')
                      }
                    />
                  </Box>

                  {/* Params section */}
                  {event.queryParams && Object.keys(event.queryParams).length > 0 && (
                    <Fragment>
                      <Box fontWeight="semibold" opacity={0.6}>
                        Query Params
                      </Box>
                      <Grid
                        gridTemplateColumns="1fr max-content minmax(0, max-content)"
                        gap="1"
                        fontFamily="mono"
                        overflow="hidden"
                        alignItems="center"
                      >
                        {Object.entries(event.queryParams).map(([key, value]) => (
                          <Fragment key={key}>
                            <Flex justify="flex-end">
                              <Tag.Root size="md">
                                <Tag.Label truncate title={key}>
                                  {key}
                                </Tag.Label>
                              </Tag.Root>
                            </Flex>
                            <Span fontSize="xs">=</Span>
                            <Flex>
                              <Tag.Root colorPalette="blue" size="md">
                                <Tag.Label truncate title={String(value)}>
                                  {String(value)}
                                </Tag.Label>
                              </Tag.Root>
                            </Flex>
                          </Fragment>
                        ))}
                      </Grid>
                    </Fragment>
                  )}
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
                      <RenderAttributeValue value={value} />
                    </Box>
                  </Fragment>
                ))}
            </SimpleGrid>
          </Box>
          {isFooterVisible && (
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
              <Tooltip content="Browser">
                <Flex align="center" gap={1.5}>
                  <BrowserIcon browserName={event.clientName ?? ''} />
                  <Text textStyle="sm" fontWeight="medium" truncate>
                    {event.clientName ?? 'Unknown'}
                    {!isEntityUnknown(event.clientVersion) && <Span opacity={0.5}> {event.clientVersion}</Span>}
                  </Text>
                </Flex>
              </Tooltip>
              <Tooltip content="Operating System">
                <Flex align="center" gap={1.5}>
                  <OsIcon osName={event.osName ?? ''} />
                  <Text textStyle="sm" fontWeight="medium" truncate>
                    {event.osName ?? 'Unknown'}
                    {!isEntityUnknown(event.osVersion) && <Span opacity={0.5}> {event.osVersion}</Span>}
                  </Text>
                </Flex>
              </Tooltip>
              <Tooltip content="Device">
                <Flex align="center" gap={1.5}>
                  <DeviceIcon deviceType={event.deviceType ?? ''} />
                  <Text textStyle="sm" fontWeight="medium" truncate>
                    {event.deviceType ?? 'unknown'}
                  </Text>
                </Flex>
              </Tooltip>
            </Flex>
          )}
        </motion.div>
      </Card.Body>
    </Card.Root>
  );
};
