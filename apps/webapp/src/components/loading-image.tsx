import type { ImageProps } from '@chakra-ui/react';
import { Box, Center, Image, Skeleton } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

export const LoadingImage = (props: ImageProps) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [props.src]);

  return (
    <Box position="relative" flexShrink="0">
      {loading && (
        <Center pos="absolute" inset="0">
          <Skeleton boxSize="90%" />
        </Center>
      )}
      <Image {...props} opacity={loading ? 0 : 1} onLoad={() => setLoading(false)} />
    </Box>
  );
};
