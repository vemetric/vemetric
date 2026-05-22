import { Box, Icon } from '@chakra-ui/react';
import type { GlobeMarkerUser } from '@/utils/trpc';
import { GlobeUserAvatar } from './globe-user-avatar';

const MARKER_LINE_HEIGHT = 15;

const getUserCountLabel = (count: number) => (count > 99 ? '99+' : `${count}`);

interface Props {
  id: string;
  users: Array<GlobeMarkerUser>;
  userCount: number;
  setMarkerElement: (id: string, element: HTMLDivElement | null) => void;
}

export const GlobeMarker = ({ id, users, userCount, setMarkerElement }: Props) => {
  const showUserCount = userCount > 3;

  return (
    <Box
      ref={(element: HTMLDivElement | null) => setMarkerElement(id, element)}
      opacity={`var(--cobe-visible-${id}, 0)`}
      transition="opacity .2s ease-in-out"
      pos="absolute"
      positionAnchor={`--cobe-${id}`}
      top="anchor(center)"
      left="anchor(center)"
      transform="scale(var(--globe-marker-scale))"
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
        opacity="0.9"
        css={{
          '--path-color': 'var(--chakra-colors-purple-400)',
        }}
      >
        <svg>
          <path d="M0 0 C-16 34 32 72 15 100 L35 100 C18 72 66 34 50 0 Z" fill="var(--path-color)" />
        </svg>
      </Icon>
      <Box pos="absolute" bg="purple.fg" boxSize="4px" rounded="full" transform="translate(-2px, -2px)" />
      <Box pos="absolute" boxSize="32px" transform={`translate(-15px, -${MARKER_LINE_HEIGHT + 26}px)`}>
        {users.length === 1 && <GlobeUserAvatar {...users[0]} />}
        {users.length === 2 && (
          <>
            <GlobeUserAvatar {...users[0]} transform="translate(-5px,-5px) scale(0.85)" />
            <GlobeUserAvatar {...users[1]} transform="translate(5px,5px) scale(0.85)" />
          </>
        )}
        {users.length > 2 && (
          <>
            <GlobeUserAvatar {...users[0]} transform="translate(-5px,-7px) scale(0.7)" />
            <GlobeUserAvatar {...users[1]} transform="translate(7px,0px) scale(0.7)" />
            <GlobeUserAvatar {...users[2]} transform="translate(-2px,5px) scale(0.7)" />
            {showUserCount && (
              <Box
                pos="absolute"
                top="-9px"
                right="-9px"
                minW="21px"
                h="21px"
                px="4px"
                rounded="full"
                bg="purple.500"
                color="white"
                border="1.5px solid"
                borderColor="bg"
                boxShadow="sm"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="xs"
                fontWeight="bold"
                lineHeight="1"
                title={`${userCount} users`}
                userSelect="none"
              >
                {getUserCountLabel(userCount)}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};
