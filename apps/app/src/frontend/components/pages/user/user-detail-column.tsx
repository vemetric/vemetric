import {
  Alert,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Skeleton,
  Span,
  Text,
  Link as ChakraLink,
} from '@chakra-ui/react';
import { COUNTRIES } from '@vemetric/common/countries';
import { Fragment, useEffect, useRef, useState } from 'react';
import { TbEye, TbDirectionSign, TbUserQuestion, TbDatabaseSearch, TbActivity } from 'react-icons/tb';
import SimpleBar from 'simplebar-react';
import { BrowserIcon } from '@/components/browser-icon';
import { CardIcon } from '@/components/card-icon';
import { CountryFlag } from '@/components/country-flag';
import { DeviceIcon } from '@/components/device-icon';
import { LoadingImage } from '@/components/loading-image';
import { OsIcon } from '@/components/os-icon';
import { Status } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { observeResize } from '@/utils/dom';
import { getFaviconUrl } from '@/utils/favicon';
import { trpc } from '@/utils/trpc';
import { formatQueryParams } from '@/utils/url';
import { ActivityHeatmap } from './activity-heatmap';
import { RenderAttributeValue } from './render-attribute-value';
import { UserAvatar } from './user-avatar';
import { UserFunnelProgress } from './user-funnel-progress';

interface Props {
  projectId: string;
  userId: string;
  countryCode: string | undefined;
  isUserLoading: boolean;
  isEventsLoading: boolean;
  userName: string;
  selectedDate: string | undefined;
  isOnline: boolean;
}

export const UserDetailColumn = (props: Props) => {
  const { projectId, userId, countryCode, isUserLoading, isEventsLoading, userName, selectedDate, isOnline } = props;
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

  const { data: userData, isLoading: _isUserLoading } = trpc.users.single.useQuery({
    projectId,
    userId,
  });

  const user = userData?.user;
  const deviceData = userData?.deviceData;

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

  return (
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
                            '' + user.origin + user.pathname + formatQueryParams(user.queryParams ?? {}) + user.urlHash
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
                              It also allows you to attach attributes to them in order to store helpful information for
                              each of your users.
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
                    <ActivityHeatmap projectId={projectId} userId={userId} selectedDate={selectedDate} />
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
  );
};
