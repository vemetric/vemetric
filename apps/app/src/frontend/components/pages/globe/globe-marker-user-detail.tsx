import { Box, Button, Card, Flex, Icon, SimpleGrid, Span, Spinner, Text } from '@chakra-ui/react';
import { Link } from '@tanstack/react-router';
import { isEntityUnknown } from '@vemetric/common/event';
import { useEffect, useMemo, useState } from 'react';
import { TbArrowLeft, TbClock, TbDirectionSign, TbUserSquareRounded } from 'react-icons/tb';
import { mergeAll } from 'remeda';
import { BrowserIcon } from '@/components/browser-icon';
import { DeviceIcon } from '@/components/device-icon';
import { LoadingImage } from '@/components/loading-image';
import { OsIcon } from '@/components/os-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { getFaviconUrl } from '@/utils/favicon';
import { trpc, type GlobeBucketUser } from '@/utils/trpc';
import { formatQueryParams } from '@/utils/url';
import { getUserName } from '@/utils/user';
import { GlobeMarkerCardIdentity } from './globe-marker-card-identity';
import { GlobeSingleUserAvatar } from './globe-single-user-avatar';

interface Props {
  projectId: string;
  user?: GlobeBucketUser;
  isSingleUser: boolean;
  onBack: () => void;
  isBucketUsersLoading: boolean;
}

export const GlobeMarkerUserDetail = (props: Props) => {
  const { projectId, user: _user, isSingleUser, onBack, isBucketUsersLoading } = props;
  const { data: userData, isLoading } = trpc.globe.singleUser.useQuery(
    { projectId, userId: _user?.id ?? '' },
    { enabled: Boolean(_user) },
  );

  const user = mergeAll([_user, userData?.user]);
  const displayName = getUserName(user?.displayName, user?.identifier);
  const { deviceData, latestEvent, latestPageView, latestSession } = userData ?? {};
  const isOnline = Boolean(latestEvent?.isOnline);
  const latestPageViewUrl = latestPageView
    ? `${latestPageView.origin ?? ''}${latestPageView.pathname ?? ''}${formatQueryParams(latestPageView.queryParams ?? {})}${latestPageView.urlHash ?? ''}`
    : null;

  const isFooterVisible =
    !isEntityUnknown(deviceData?.clientName) ||
    !isEntityUnknown(deviceData?.osName) ||
    !isEntityUnknown(deviceData?.deviceType);

  const [sessionDurationNow, setSessionDurationNow] = useState(() => Date.now());
  const latestSessionDuration = useMemo(() => {
    if (!latestSession?.startedAt) {
      return null;
    }

    return dateTimeFormatter.formatDurationBetween(
      latestSession.startedAt,
      latestEvent?.isOnline ? new Date(sessionDurationNow) : latestSession.endedAt,
    );
  }, [latestEvent?.isOnline, latestSession?.startedAt, latestSession?.endedAt, sessionDurationNow]);

  useEffect(() => {
    if (!latestSession?.id || !latestEvent?.isOnline) {
      return;
    }

    setSessionDurationNow(Date.now());
    const intervalId = window.setInterval(() => {
      setSessionDurationNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [latestEvent?.isOnline, latestSession?.id]);

  return (
    <>
      <Card.Header pr={10} pb={2} px={2.5} pt={2}>
        <Flex align="center" gap={0}>
          {!isSingleUser && (
            <Button size="xs" variant="ghost" px={1.5} mr={1} onClick={onBack}>
              <Icon as={TbArrowLeft} />
            </Button>
          )}
          <Box pt={1} pr={2.5}>
            {user && (
              <GlobeSingleUserAvatar user={user} border="1.5px solid" borderColor="bg" rounded="0.6em" boxShadow="sm" />
            )}
          </Box>
          {user && (
            <GlobeMarkerCardIdentity user={user} isOnline={isOnline} displayName={displayName} variant="detail" />
          )}
        </Flex>
      </Card.Header>
      <Card.Body pt={1} pb={3} overflowY="auto">
        <Flex flexDir="column" gap={3}>
          {isLoading || isBucketUsersLoading ? (
            <Flex h="72px" align="center" justify="center">
              <Spinner size="sm" borderWidth="2px" />
            </Flex>
          ) : latestSession || latestPageViewUrl ? (
            <Box>
              <Flex align="center" gap={1.5} mb={1.5} color="fg.muted">
                <Icon as={TbClock} />
                <Text textStyle="xs" fontWeight="semibold">
                  Session
                </Text>
              </Flex>
              <SimpleGrid textStyle="xs" columns={2} gap={1.5} gridTemplateColumns="1fr 2fr">
                {latestSessionDuration && (
                  <>
                    <Box fontWeight="semibold" opacity={0.6}>
                      Duration
                    </Box>
                    <Text fontWeight="medium" textAlign="right" truncate>
                      {latestSessionDuration}
                    </Text>
                  </>
                )}
                {latestSession && (
                  <>
                    <Box fontWeight="semibold" opacity={0.6}>
                      Referrer
                    </Box>
                    <Flex justify="flex-end" minW={0}>
                      <Tooltip
                        content={
                          latestSession.referrer ? `Referred via ${latestSession.referrerUrl}` : 'Direct page visit.'
                        }
                      >
                        <Flex align="center" gap={1} minW={0}>
                          <Flex
                            align="center"
                            justify="center"
                            flexShrink={0}
                            boxSize="16px"
                            bg="gray.subtle"
                            rounded="4px"
                            color="gray.fg"
                            overflow="hidden"
                          >
                            {latestSession.referrer && latestSession.referrerUrl ? (
                              <LoadingImage
                                src={getFaviconUrl(latestSession.referrerUrl)}
                                alt={`${latestSession.referrer} favicon`}
                                boxSize="14px"
                              />
                            ) : (
                              <TbDirectionSign />
                            )}
                          </Flex>
                          <Text fontWeight="medium" truncate>
                            {latestSession.referrer || 'Direct'}
                          </Text>
                        </Flex>
                      </Tooltip>
                    </Flex>
                  </>
                )}
                {latestPageViewUrl && (
                  <>
                    <Flex align="center" gap={1} fontWeight="semibold" opacity={0.6}>
                      {isOnline ? 'Current URL' : 'Last URL'}
                    </Flex>
                    <Tooltip content={latestPageViewUrl} positioning={{ placement: 'bottom-end' }}>
                      <Text fontWeight="medium" textAlign="right" truncate>
                        {latestPageViewUrl}
                      </Text>
                    </Tooltip>
                  </>
                )}
              </SimpleGrid>
            </Box>
          ) : (
            <Text textStyle="xs" color="fg.muted">
              No data available for this user.
            </Text>
          )}
        </Flex>
      </Card.Body>
      {user && (
        <Card.Footer p={0} flexDir="column" gap={0}>
          <Flex justify="flex-end" w="100%" px={1.5} pb={1.5}>
            <Button asChild size="xs" variant="surface" alignSelf="flex-start">
              <Link to="/p/$projectId/users/$userId" params={{ projectId, userId: user.id }}>
                <Icon as={TbUserSquareRounded} />
                View user
              </Link>
            </Button>
          </Flex>
          {isFooterVisible && (
            <Flex
              w="100%"
              gap={3}
              align="center"
              justify="space-between"
              opacity={0.8}
              borderTop="1px solid"
              borderColor="gray.emphasized"
              pt={3}
              pb={2}
              px={2}
              bg="gray.subtle/50"
              flexWrap="wrap"
            >
              <Tooltip content="Browser">
                <Flex align="center" gap={1}>
                  <BrowserIcon browserName={deviceData?.clientName ?? ''} />
                  <Text textStyle="xs" fontWeight="medium" truncate>
                    {deviceData?.clientName ?? 'Unknown'}
                    {!isEntityUnknown(deviceData?.clientVersion) && (
                      <Span opacity={0.5}> {deviceData?.clientVersion}</Span>
                    )}
                  </Text>
                </Flex>
              </Tooltip>
              <Tooltip content="Operating System">
                <Flex align="center" gap={1}>
                  <OsIcon osName={deviceData?.osName ?? ''} />
                  <Text textStyle="xs" fontWeight="medium" truncate>
                    {deviceData?.osName ?? 'Unknown'}
                    {!isEntityUnknown(deviceData?.osVersion) && <Span opacity={0.5}> {deviceData?.osVersion}</Span>}
                  </Text>
                </Flex>
              </Tooltip>
              <Tooltip content="Device">
                <Flex align="center" gap={1}>
                  <DeviceIcon deviceType={deviceData?.deviceType ?? ''} />
                  <Text textStyle="xs" fontWeight="medium" truncate>
                    {deviceData?.deviceType ?? 'unknown'}
                  </Text>
                </Flex>
              </Tooltip>
            </Flex>
          )}
        </Card.Footer>
      )}
    </>
  );
};
