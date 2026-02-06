import { Avatar, Box, Flex, Text } from '@chakra-ui/react';

interface Props {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  mode?: 'inline' | 'stacked';
  avatarSize?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  avatarBg?: string;
  primaryLabel?: string;
  unknownLabel?: string;
  isCurrentUser?: boolean;
  textColor?: string;
}

export const UserIdentity = ({
  name,
  email,
  image,
  mode = 'inline',
  avatarSize = 'sm',
  avatarBg,
  primaryLabel,
  unknownLabel = 'Unknown',
  isCurrentUser = false,
  textColor,
}: Props) => {
  const displayName = primaryLabel || name || email || unknownLabel;

  return (
    <Flex align="center" gap={2}>
      <Avatar.Root size={avatarSize} bg={avatarBg}>
        <Avatar.Fallback>{displayName.charAt(0).toUpperCase()}</Avatar.Fallback>
        {image && <Avatar.Image src={image} />}
      </Avatar.Root>
      <Box>
        <Text fontWeight={mode === 'stacked' ? 'medium' : 'normal'} color={textColor} lineClamp={1}>
          {displayName}
          {isCurrentUser && (
            <Text as="span" color="fg.muted" fontWeight="normal">
              {' '}
              (you)
            </Text>
          )}
        </Text>
        {mode === 'stacked' && email && (
          <Text fontSize="sm" color="fg.muted" lineClamp={1}>
            {email}
          </Text>
        )}
      </Box>
    </Flex>
  );
};
