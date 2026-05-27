import { Box, Card, CloseButton, Flex, Icon, Spinner } from '@chakra-ui/react';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { useRef, useState } from 'react';
import { trpc, type GlobeMarkerUser } from '@/utils/trpc';
import { GlobeMarkerUserDetail } from './globe-marker-user-detail';
import { GlobeMarkerUserList } from './globe-marker-user-list';
import { GlobeMultiUserAvatar } from './globe-multi-user-avatar';
import { GlobeSingleUserAvatar } from './globe-single-user-avatar';

const MARKER_LINE_HEIGHT = 15;

interface Props {
  projectId: string;
  timespan: TimeSpan;
  startDate?: string;
  endDate?: string;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  id: string;
  users: Array<GlobeMarkerUser>;
  userCount: number;
  setMarkerElement: (id: string, element: HTMLDivElement | null) => void;
}

export const GlobeMarker = (props: Props) => {
  const {
    projectId,
    timespan,
    startDate,
    endDate,
    isOpen,
    setOpen,
    id,
    users: bucketPreviewUsers,
    userCount,
    setMarkerElement,
  } = props;

  const { data: bucketUsersData, isLoading: isBucketUsersLoading } = trpc.globe.getBucketUsers.useQuery(
    { projectId, timespan, startDate, endDate, bucketId: id },
    { enabled: isOpen },
  );
  const cardUsers = bucketUsersData?.users ?? [];
  const [_selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUserId = _selectedUserId ?? (cardUsers.length === 1 ? cardUsers[0].id : null);

  const selectedUser = cardUsers.find((user) => user.id === selectedUserId);
  const showUserDetail = isOpen && Boolean(selectedUserId);
  const showMarkerAvatars = !isOpen || isBucketUsersLoading;
  const userListScrollOffsetRef = useRef(0);

  const closeCard = () => {
    setOpen(false);
    setSelectedUserId(null);
    userListScrollOffsetRef.current = 0;
  };
  const selectUser = (userId: string) => {
    setSelectedUserId(userId);
  };
  const showUserList = () => {
    setSelectedUserId(null);
  };

  return (
    <Box
      ref={(element: HTMLDivElement | null) => setMarkerElement(id, element)}
      opacity={`var(--cobe-visible-${id}, 0)`}
      transition="opacity .2s ease-in-out"
      pos="absolute"
      positionAnchor={`--cobe-${id}`}
      top="anchor(center)"
      left="anchor(center)"
      zIndex={isOpen ? '9999999!important' : undefined}
    >
      {isOpen && (
        <Card.Root
          pos="absolute"
          width="400px"
          maxH="330px"
          left="calc(-25px)"
          top="calc(-60px)"
          bg="bg.card/80"
          outline="1.5px solid"
          outlineColor="bg"
          backdropFilter="blur(10px)"
          transform={isOpen ? 'translateY(0px)' : 'translateY(-20px)'}
          opacity={isOpen ? 1 : 0}
          transition="all .2s ease-in-out"
          overflow="hidden"
          pointerEvents={isOpen ? 'auto' : 'none'}
          inert={isOpen ? undefined : true}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onWheel={(e) => {
            e.stopPropagation();
          }}
          cursor="default"
          _dark={{
            outlineColor: 'bg.content',
          }}
        >
          <CloseButton onClick={closeCard} pos="absolute" right="0" top="0" size="xs" zIndex={3} />
          {isBucketUsersLoading ? (
            <Flex h="120px" align="center" justify="center">
              <Spinner size="sm" borderWidth="2px" />
            </Flex>
          ) : showUserDetail && selectedUser ? (
            <GlobeMarkerUserDetail
              projectId={projectId}
              user={selectedUser}
              isSingleUser={userCount === 1}
              onBack={showUserList}
            />
          ) : (
            <GlobeMarkerUserList
              users={cardUsers}
              userCount={userCount}
              initialScrollOffset={userListScrollOffsetRef.current}
              onScrollOffsetChange={(scrollOffset) => {
                userListScrollOffsetRef.current = scrollOffset;
              }}
              onSelectUser={selectUser}
            />
          )}
        </Card.Root>
      )}
      <Box transform="scale(var(--globe-marker-scale))">
        <Box
          transform={isOpen ? 'scale(calc(1.1 * var(--globe-marker-scale-inverse, 1)))' : 'scale(1)'}
          transition={'transform .1s ease-in-out'}
        >
          <Box transform={`scale(var(--cobe-visible-${id}, 0))`}>
            <Box
              transform={isOpen ? 'scale(1)!important' : undefined}
              _hover={{ transform: 'scale(1.06)' }}
              transition="transform .1s ease-in-out"
              pos="relative"
              pointerEvents={isOpen ? 'none' : 'auto'}
              cursor="pointer"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={() => {
                setOpen(true);
              }}
            >
              <Icon
                width="10px"
                height={`${MARKER_LINE_HEIGHT}px`}
                viewBox="0 0 50 100"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                pos="absolute"
                transform={`translate(-5px, -${MARKER_LINE_HEIGHT}px)`}
                opacity={isOpen ? 0 : '0.9'}
                css={{
                  '--path-color': 'var(--chakra-colors-purple-400)',
                }}
              >
                <svg>
                  <path d="M0 0 C-16 34 32 72 15 100 L35 100 C18 72 66 34 50 0 Z" fill="var(--path-color)" />
                </svg>
              </Icon>
              <Box
                pos="absolute"
                bg="purple.fg"
                boxSize="4px"
                rounded="full"
                transform="translate(-2px, -2px)"
                opacity={isOpen ? 0 : 1}
              />
              <Box pos="absolute" boxSize="32px" transform={`translate(-15px, -${MARKER_LINE_HEIGHT + 26}px)`}>
                {showMarkerAvatars && (
                  <>
                    {bucketPreviewUsers.length === 1 ? (
                      <GlobeSingleUserAvatar
                        user={bucketPreviewUsers[0]}
                        border="1.5px solid"
                        borderColor="bg"
                        rounded="0.6em"
                        boxShadow="sm"
                      />
                    ) : (
                      <GlobeMultiUserAvatar users={bucketPreviewUsers} userCount={userCount} />
                    )}
                  </>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
