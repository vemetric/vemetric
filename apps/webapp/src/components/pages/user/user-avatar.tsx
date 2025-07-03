import type { FlexProps } from '@chakra-ui/react';
import { Flex, Image } from '@chakra-ui/react';
import { getUserInitials } from '@/utils/avatar-colors';

interface Props extends FlexProps {
  displayName?: string;
  identifier?: string;
  id: string;
}

export const UserAvatar = ({ displayName, identifier, id, ...props }: Props) => {
  return (
    <Flex
      pos="relative"
      rounded="md"
      boxSize="32px"
      justify="center"
      align="center"
      fontWeight="bold"
      fontSize="sm"
      flexShrink={0}
      overflow="hidden"
      filter={identifier || displayName ? 'none' : 'grayscale(100%)'}
      color="white"
      {...props}
    >
      <Image
        src={`https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(id.trim())}`}
        alt={displayName || identifier}
      />
      <Flex pos="absolute" inset={0} bg="blackAlpha.400" justify="center" align="center">
        {getUserInitials(displayName, identifier)}
      </Flex>
    </Flex>
  );
};
