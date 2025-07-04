import { Box } from '@chakra-ui/react';

export const PageDotBackground = () => {
  return (
    <Box
      pos="absolute"
      inset="1.5"
      backgroundImage="radial-gradient(circle at 1px 1px, var(--chakra-colors-gray-emphasized) 1px, transparent 0)"
      backgroundSize="15px 15px"
      opacity={0.5}
    />
  );
};
