import type { ImageProps } from '@chakra-ui/react';
import { Box, Center, Image, Skeleton } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { TbWorldQuestion } from 'react-icons/tb';

interface Props extends ImageProps {}

export const LoadingImage = (props: Props) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
  }, [props.src]);

  return (
    <Box position="relative" flexShrink="0">
      {(loading || error) && (
        <Center pos="absolute" inset="0">
          {error ? <TbWorldQuestion /> : <Skeleton boxSize="90%" />}
        </Center>
      )}
      <Image
        {...props}
        opacity={loading || error ? 0 : 1}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
      />
    </Box>
  );
};
