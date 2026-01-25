import { Box, Flex } from '@chakra-ui/react';
import type { IFilterConfig } from '@vemetric/common/filters';
import type { RoutesWithFiltering } from '~/hooks/use-filters';
import { useFilters } from '~/hooks/use-filters';
import { FilterGroup } from './filter-group';

interface Props {
  filterConfig: IFilterConfig;
  from: RoutesWithFiltering;
}

export const FilterContainer = ({ filterConfig, from }: Props) => {
  const { removeAllFilters, setFilters } = useFilters({ from });

  if (!filterConfig || filterConfig.filters.length === 0) {
    return null;
  }

  return (
    <Box maxH={{ base: '70px', md: '105px' }} overflowY="auto" overflowX="hidden" mr={-2} pr={2}>
      <Flex align="center" gap={2}>
        <FilterGroup
          group={{ type: 'group', ...filterConfig }}
          onChange={setFilters}
          onDelete={removeAllFilters}
          nested={false}
        />
      </Flex>
    </Box>
  );
};
