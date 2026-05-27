import { Box } from '@chakra-ui/react';
import { motion } from 'motion/react';
import type { GlobeBucketUser, GlobeMarkerUser } from '@/utils/trpc';
import type { UserAvatarProps } from '../user/user-avatar';
import { UserAvatar } from '../user/user-avatar';

interface Props extends Omit<UserAvatarProps, 'id'> {
  user: GlobeMarkerUser | GlobeBucketUser;
}

export const GlobeSingleUserAvatar = ({ user, ...props }: Props) => {
  return (
    <Box asChild flexShrink={0} pos="relative" zIndex={2}>
      <motion.div layoutId={`globe-single-user-avatar-${user.id}`} transition={{ duration: 0.18, ease: 'easeInOut' }}>
        <UserAvatar
          id={user.id}
          identifier={user.identifier}
          displayName={user.displayName}
          avatarUrl={user.avatarUrl}
          {...props}
        />
      </motion.div>
    </Box>
  );
};
