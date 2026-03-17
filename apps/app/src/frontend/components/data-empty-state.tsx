import { Button, Flex } from '@chakra-ui/react';
import type { IFilterConfig } from '@vemetric/common/filters';
import { TbFilterOff } from 'react-icons/tb';
import { TimespanSelect } from '@/components/timespan-select';
import type { EmptyStateProps } from '@/components/ui/empty-state';
import { EmptyState } from '@/components/ui/empty-state';
import { useFilters } from '@/hooks/use-filters';
import type { RoutesWithFiltering } from '@/hooks/use-filters';
import type { TimespanRoute } from '@/hooks/use-timespan-param';
import { Tooltip } from './ui/tooltip';

interface Props extends Omit<EmptyStateProps, 'children'> {
  filterConfig?: IFilterConfig;
  filterRoute: RoutesWithFiltering;
  timespanRoute: TimespanRoute;
}

export const DataEmptyState = ({ filterConfig, filterRoute, timespanRoute, ...emptyStateProps }: Props) => {
  const { removeAllFilters } = useFilters({ from: filterRoute });
  const filterCount = filterConfig?.filters?.length ?? 0;
  const hasFilters = filterCount > 0;

  return (
    <EmptyState {...emptyStateProps}>
      <Flex align="center" gap={3}>
        <Tooltip content={'No filters selected'} disabled={hasFilters}>
          <Button size={{ base: 'xs', md: 'sm' }} variant="surface" onClick={removeAllFilters} disabled={!hasFilters}>
            <TbFilterOff />
            Clear filters
          </Button>
        </Tooltip>
        <TimespanSelect from={timespanRoute} />
      </Flex>
    </EmptyState>
  );
};
