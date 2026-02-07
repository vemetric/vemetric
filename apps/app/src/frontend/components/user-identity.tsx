import { Avatar, Box, Flex, Text } from '@chakra-ui/react';

interface Props {
  displayName: string;
  email?: string | null;
  image?: string | null;
  avatarSize?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isCurrentUser?: boolean;
}

export const UserIdentity = ({ displayName, email, image, avatarSize = 'sm', isCurrentUser = false }: Props) => {
  return (
    <Flex align="center" gap={2}>
      <Avatar.Root size={avatarSize}>
        <Avatar.Fallback>{displayName.charAt(0).toUpperCase()}</Avatar.Fallback>
        {image && <Avatar.Image src={image} />}
      </Avatar.Root>
      <Box>
        <Text fontWeight={email ? 'medium' : 'normal'} lineClamp={1}>
          {displayName}
          {isCurrentUser && (
            <Text as="span" color="fg.muted" fontWeight="normal">
              {' '}
              (you)
            </Text>
          )}
        </Text>
        {email && (
          <Text fontSize="sm" color="fg.muted" lineClamp={1}>
            {email}
          </Text>
        )}
      </Box>
    </Flex>
  );
};
