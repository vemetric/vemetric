import type { FlexProps } from '@chakra-ui/react';
import { Flex } from '@chakra-ui/react';

export function PageWrapper(props: FlexProps) {
  return <Flex mx="auto" maxW="1400px" {...props} />;
}
