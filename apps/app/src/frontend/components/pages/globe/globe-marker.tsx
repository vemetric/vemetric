import { Box, Icon } from '@chakra-ui/react';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { memo, useRef } from 'react';
import { type GlobeMarkerUser } from '@/utils/trpc';
import { GlobeMarkerCard } from './globe-marker-card';
import { GlobeMultiUserAvatar } from './globe-multi-user-avatar';
import { GlobeSingleUserAvatar } from './globe-single-user-avatar';

const MARKER_LINE_HEIGHT = 15;

interface Props {
  projectId: string;
  timespan: TimeSpan;
  startDate?: string;
  endDate?: string;
  isOpen: boolean;
  setOpen: (id: string, open: boolean) => void;
  id: string;
  bucketIds: string[];
  users: Array<GlobeMarkerUser>;
  userCount: number;
  selectedUserId?: string | null;
  setSelectedUserId: (userId: string | null) => void;
  setMarkerElement: (id: string, element: HTMLDivElement | null) => void;
}

export const GlobeMarker = memo((props: Props) => {
  const {
    projectId,
    timespan,
    startDate,
    endDate,
    isOpen,
    setOpen,
    id,
    bucketIds,
    users: bucketPreviewUsers,
    userCount,
    selectedUserId,
    setSelectedUserId,
    setMarkerElement,
  } = props;

  const userListScrollOffsetRef = useRef(0);
  const showMarkerAvatars = !isOpen;

  const closeCard = () => {
    setOpen(id, false);
    userListScrollOffsetRef.current = 0;
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
      transform={`scale(var(--cobe-visible-${id}, 0))`}
    >
      {isOpen && (
        <GlobeMarkerCard
          projectId={projectId}
          timespan={timespan}
          startDate={startDate}
          endDate={endDate}
          bucketIds={bucketIds}
          userCount={userCount}
          markerUsers={bucketPreviewUsers}
          selectedUserId={selectedUserId}
          closeCard={closeCard}
          selectUser={setSelectedUserId}
          showUserList={showUserList}
          userListScrollOffsetRef={userListScrollOffsetRef}
        />
      )}
      <Box transform="scale(var(--globe-marker-scale))">
        <Box
          transform={isOpen ? 'scale(calc(1.1 * var(--globe-marker-scale-inverse, 1)))' : 'scale(1)'}
          transition={'transform .1s ease-in-out'}
        >
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
              setOpen(id, true);
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
  );
});

GlobeMarker.displayName = 'GlobeMarker';
