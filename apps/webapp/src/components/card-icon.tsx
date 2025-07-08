import type { FlexProps } from '@chakra-ui/react';
import { Box, Flex } from '@chakra-ui/react';

export interface CardIconProps extends FlexProps {
  size?: 'xs' | 'md' | 'lg';
}

export const CardIcon = ({ children, size = 'md', ...props }: CardIconProps) => {
  let padding = 1.5;
  switch (size) {
    case 'xs':
      padding = 0.5;
      break;
    case 'lg':
      padding = 2;
      break;
  }

  let fontSize = 'md';
  switch (size) {
    case 'xs':
      fontSize = '15px';
      break;
    case 'lg':
      fontSize = '20px';
      break;
  }

  let rounded = 'lg';
  switch (size) {
    case 'xs':
      rounded = 'md';
      break;
    case 'lg':
      rounded = 'xl';
      break;
  }

  return (
    <Flex
      pos="relative"
      color="fg"
      align="center"
      border="1px solid"
      borderColor="purple.emphasized"
      bg="bg.card"
      boxShadow="sm"
      outline="2px solid"
      outlineColor="white"
      rounded={rounded}
      p={padding}
      fontSize={fontSize}
      _dark={{ outlineColor: 'gray.700/10', boxShadow: 'xs' }}
      {...props}
    >
      <Box pos="absolute" inset="0" bg="purple.subtle/50" rounded="lg" />
      <Box pos="relative">{children}</Box>
    </Flex>
  );
};
