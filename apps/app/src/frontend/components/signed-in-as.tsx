import { Flex, Text, type FlexProps } from '@chakra-ui/react';
import { UserIdentity } from './user-identity';

interface Props extends FlexProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

/** "Signed in as" with the user's avatar and name, on pages where it matters which account acts (e.g. consent). */
export const SignedInAs = ({ user, ...flexProps }: Props) => (
  <Flex align="center" gap={2} justify="center" flexWrap="wrap" color="fg.muted" {...flexProps}>
    <Text fontSize="sm" flexShrink="0">
      Signed in as
    </Text>
    <UserIdentity displayName={user.name || user.email || 'Unnamed'} image={user.image} avatarSize="2xs" />
  </Flex>
);
