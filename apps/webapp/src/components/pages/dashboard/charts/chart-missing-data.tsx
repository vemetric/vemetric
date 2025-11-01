import { EmptyState } from '@/components/ui/empty-state';
import { Flex } from '@chakra-ui/react';
import { TbActivity } from 'react-icons/tb';

export const DashboardChartDataMissing = () => {
  return (
    <Flex pos="absolute" inset={0} justify="center" align="center">
      <EmptyState
        size={{ base: 'sm', md: 'md' }}
        icon={<TbActivity />}
        title="No data available in the selected timeframe"
      />
    </Flex>
  );
};
