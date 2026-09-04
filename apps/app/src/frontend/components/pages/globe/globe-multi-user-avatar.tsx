import { Box } from '@chakra-ui/react';
import { motion } from 'motion/react';
import type { GlobeBucketUser, GlobeMarkerUser } from '@/utils/trpc';
import type { UserAvatarProps } from '../user/user-avatar';
import { UserAvatar } from '../user/user-avatar';

const GlobeMarkerAvatar = (props: UserAvatarProps) => (
  <UserAvatar pos="absolute" border="1.5px solid" borderColor="bg" rounded="0.6em" boxShadow="sm" {...props} />
);

interface Props {
  users: Array<GlobeMarkerUser | GlobeBucketUser>;
  userCount?: number;
}

export const GlobeMultiUserAvatar = ({ users, userCount = 0 }: Props) => {
  if (users.length < 2) {
    return null;
  }

  return (
    <Box asChild flexShrink={0} pos="relative" zIndex={2} boxSize="32px">
      <motion.div
        layoutId={`globe-multi-user-avatar-${users[0].id}`}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
      >
        {users.length === 2 ? (
          <>
            <GlobeMarkerAvatar {...users[0]} transform="translate(-5px,-5px) scale(0.85)" />
            <GlobeMarkerAvatar {...users[1]} transform="translate(5px,5px) scale(0.85)" />
          </>
        ) : (
          <>
            <GlobeMarkerAvatar {...users[0]} transform="translate(-5px,-7px) scale(0.7)" />
            <GlobeMarkerAvatar {...users[1]} transform="translate(7px,0px) scale(0.7)" />
            <GlobeMarkerAvatar {...users[2]} transform="translate(-2px,5px) scale(0.7)" />
            {userCount > 3 && (
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
                zIndex={3}
              >
                {`${userCount > 99 ? '99+' : userCount}`}
              </Box>
            )}
          </>
        )}
      </motion.div>
    </Box>
  );
};
