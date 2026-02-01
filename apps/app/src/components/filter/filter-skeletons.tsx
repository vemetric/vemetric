import type { FlexProps } from '@chakra-ui/react';
import { Box, Flex } from '@chakra-ui/react';
import { Skeleton } from '../ui/skeleton';

export const FilterSkeletons = ({ loading, ...props }: { loading: boolean } & FlexProps) => (
  <Flex {...props}>
    <Flex gap={3}>
      <Skeleton height={[7, 9]} width={['55px', '100px']} loading={loading} />
      <Skeleton height={[7, 9]} width={['55px', '100px']} loading={loading} />
      <Skeleton height={[7, 9]} width={['55px', '100px']} loading={loading} />
    </Flex>
    <Box flexGrow={1} />
    <Skeleton height={[7, 9]} width={['90px', '144px']} loading={loading} />
  </Flex>
);
