import type { ImageProps } from '@chakra-ui/react';
import { Box, Center, Image, Skeleton, Icon } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { TbWorldQuestion } from 'react-icons/tb';
import { IS_SELF_HOSTED } from '@/utils/self-hosted';

interface Props extends ImageProps {}

export const LoadingImage = (props: Props) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Self hosted instances have no favicon service, so these images are rendered without a
  // source and no load event ever fires. Showing the placeholder right away avoids a skeleton
  // that would spin forever. The hosted instance always has a source and keeps its previous
  // behaviour, where an empty source shows the skeleton until the load event decides.
  const showPlaceholder = error || (IS_SELF_HOSTED && !props.src);

  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    setError(false);
    setLoading(true);
  }, [props.src]);

  return (
    <Box position="relative" flexShrink="0">
      {(loading || showPlaceholder) && (
        <Center pos="absolute" inset="0">
          {showPlaceholder ? <Icon as={TbWorldQuestion} boxSize="100%" color="#838383" /> : <Skeleton boxSize="90%" />}
        </Center>
      )}
      <Image
        {...props}
        opacity={loading || showPlaceholder ? 0 : 1}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
      />
    </Box>
  );
};
