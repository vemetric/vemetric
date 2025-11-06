import { Box } from '@chakra-ui/react';
import type { PropsWithChildren, ReactNode } from 'react';

interface Props {
  label: ReactNode;
}

export const ChartTooltip = ({ label, children }: PropsWithChildren<Props>) => {
  return (
    <Box
      border="1px solid"
      borderColor="purple.emphasized"
      rounded="lg"
      bg="bg"
      minW="140px"
      overflow="hidden"
      boxShadow="sm"
    >
      <Box px={3} py={2} borderBottom="1px solid" borderColor="purple.muted" fontWeight="semibold" bg="purple.subtle">
        {label}
      </Box>
      {children}
    </Box>
  );
};
