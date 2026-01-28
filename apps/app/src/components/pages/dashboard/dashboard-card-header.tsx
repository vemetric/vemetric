import type { CardHeaderProps } from '@chakra-ui/react';
import { Card } from '@chakra-ui/react';

export const DashboardCardHeader = (props: CardHeaderProps) => {
  return (
    <Card.Header
      fontWeight="semibold"
      fontSize="md"
      p={2.5}
      flexDirection="row"
      alignItems="center"
      gap={2.5}
      borderBottom="1px solid"
      borderColor="gray.emphasized/50"
      {...props}
    />
  );
};
