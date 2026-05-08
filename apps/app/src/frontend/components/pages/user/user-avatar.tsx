import type { FlexProps } from '@chakra-ui/react';
import { Flex, Image } from '@chakra-ui/react';
import { Facehash } from 'facehash';

export interface UserAvatarProps extends FlexProps {
  displayName?: string;
  avatarUrl?: string;
  identifier?: string;
  id: string;
  enableBlink?: boolean;
}

export const UserAvatar = ({ displayName, avatarUrl, identifier, id, enableBlink, ...props }: UserAvatarProps) => {
  return (
    <Flex
      pos="relative"
      rounded="md"
      boxSize="32px"
      justify="center"
      align="center"
      flexShrink={0}
      overflow="hidden"
      userSelect="none"
      filter={identifier || displayName ? 'none' : 'grayscale(60%)'}
      {...props}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={displayName || identifier} boxSize="100%" objectFit="cover" />
      ) : (
        <Facehash
          enableBlink={enableBlink}
          name={(displayName || identifier || '?') + id}
          size={32}
          colors={[
            'var(--chakra-colors-red-500)',
            'var(--chakra-colors-green-500)',
            'var(--chakra-colors-teal-500)',
            'var(--chakra-colors-blue-500)',
            'var(--chakra-colors-pink-500)',
            'var(--chakra-colors-orange-500)',
          ]}
        />
      )}
    </Flex>
  );
};
