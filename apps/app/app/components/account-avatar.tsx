import type { AvatarRootProps } from '@chakra-ui/react';
import { Avatar, Skeleton } from '@chakra-ui/react';
import { authClient } from '~/utils/auth';

interface Props {
  boxSize?: AvatarRootProps['boxSize'];
  fontSize?: AvatarRootProps['fontSize'];
}

export const AccountAvatar = ({ boxSize = { base: '36px', md: '40px' }, fontSize }: Props) => {
  const { data: session, isPending } = authClient.useSession();
  const { user } = session ?? {};

  return isPending ? (
    <Skeleton rounded="full" boxSize={boxSize} />
  ) : (
    <Avatar.Root boxSize={boxSize} bg="linear-gradient(45deg, #7e48f850, #a086ff50)">
      <Avatar.Fallback name={user?.name || '?'} color="gray.fg" fontSize={fontSize} />
      {user?.image && <Avatar.Image src={user.image} />}
    </Avatar.Root>
  );
};
