import type { UserAvatarProps } from '../user/user-avatar';
import { UserAvatar } from '../user/user-avatar';

export const GlobeUserAvatar = (props: UserAvatarProps) => {
  return (
    <UserAvatar
      enableBlink
      pos="absolute"
      border="1.5px solid"
      borderColor="bg"
      rounded="0.6em"
      boxShadow="sm"
      {...props}
    />
  );
};
