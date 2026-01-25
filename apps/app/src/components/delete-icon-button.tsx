import type { IconButtonProps } from '@chakra-ui/react';
import { Icon, IconButton } from '@chakra-ui/react';
import { TbTrash } from 'react-icons/tb';

export const DeleteIconButton = (props: IconButtonProps) => {
  return (
    <IconButton
      opacity="0"
      size="xs"
      pos="absolute"
      top={1}
      right={-1.5}
      variant="surface"
      minW="0"
      p="1px"
      rounded="full"
      h="auto"
      aria-label="Remove"
      _focus={{ opacity: 1 }}
      _groupHover={{ opacity: 1 }}
      zIndex="1"
      {...props}
    >
      <Icon as={TbTrash} boxSize="14px" color="fg.error" />
    </IconButton>
  );
};
