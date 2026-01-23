import { Avatar, Skeleton } from '@chakra-ui/react';
import { authClient } from '@/utils/auth';

export const AccountAvatar = () => {
  const { data: session, isPending } = authClient.useSession();
  const { user } = session ?? {};

  return isPending ? (
    <Skeleton rounded="full" boxSize="40px" />
  ) : (
    <Avatar.Root size={{ base: 'sm', md: 'md' }} bg="linear-gradient(45deg, #7e48f850, #a086ff50)">
      <Avatar.Fallback name={user?.name || '?'} color="gray.fg" />
      {user?.image && <Avatar.Image src={user.image} />}
    </Avatar.Root>
  );
};
