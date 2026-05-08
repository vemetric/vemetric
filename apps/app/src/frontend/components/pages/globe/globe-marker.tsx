import { Box } from '@chakra-ui/react';
import { GlobeUserAvatar } from './globe-user-avatar';
import type { MockGlobeUser } from './mock-data';

const MARKER_LINE_HEIGHT = 15;

const getMockUserAvatarProps = (user: MockGlobeUser) => ({
  id: user.id,
  displayName: user.name,
  avatarUrl: user.avatarUrl,
});

interface Props {
  id: string;
  users: Array<MockGlobeUser>;
}

export const GlobeMarker = ({ id, users }: Props) => {
  return (
    <Box
      opacity={`var(--cobe-visible-${id}, 0)`}
      transition="opacity .2s ease-in-out"
      zIndex="1"
      pos="absolute"
      positionAnchor={`--cobe-${id}`}
      top="anchor(center)"
      left="anchor(center)"
      transform="scale(var(--globe-marker-scale))"
    >
      <Box
        pos="absolute"
        width="2px"
        height={`${MARKER_LINE_HEIGHT}px`}
        bg="purple.500"
        transform={`translate(-1px, -${MARKER_LINE_HEIGHT}px)`}
      />
      <Box pos="absolute" bg="purple.fg" boxSize="4px" rounded="full" transform="translate(-2px, -2px)" />
      <Box pos="absolute" boxSize="32px" transform={`translate(-15px, -${MARKER_LINE_HEIGHT + 26}px)`}>
        {users.length === 1 && <GlobeUserAvatar {...getMockUserAvatarProps(users[0])} />}
        {users.length === 2 && (
          <>
            <GlobeUserAvatar {...getMockUserAvatarProps(users[0])} transform="translate(-5px,-5px) scale(0.85)" />
            <GlobeUserAvatar {...getMockUserAvatarProps(users[1])} transform="translate(5px,5px) scale(0.85)" />
          </>
        )}
        {users.length > 2 && (
          <>
            <GlobeUserAvatar {...getMockUserAvatarProps(users[0])} transform="translate(-5px,-7px) scale(0.7)" />
            <GlobeUserAvatar {...getMockUserAvatarProps(users[1])} transform="translate(7px,0px) scale(0.7)" />
            <GlobeUserAvatar {...getMockUserAvatarProps(users[2])} transform="translate(-2px,5px) scale(0.7)" />
          </>
        )}
      </Box>
    </Box>
  );
};
