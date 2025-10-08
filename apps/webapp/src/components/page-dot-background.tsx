import { Box, type BoxProps } from '@chakra-ui/react';

interface Props extends BoxProps {
  dotColor?: string;
}

export const PageDotBackground = ({ dotColor = 'var(--chakra-colors-gray-emphasized)', ...props }: Props) => {
  return (
    <Box
      pos="absolute"
      inset="1.5"
      backgroundImage={`radial-gradient(circle at 1px 1px, ${dotColor} 1px, transparent 0)`}
      backgroundSize="15px 15px"
      opacity={0.45}
      {...props}
    />
  );
};
