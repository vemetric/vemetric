import { ButtonGroup } from '@chakra-ui/react';
import type { IFilterConfig } from '@vemetric/common/filters';
import type { RoutesWithFiltering } from '@/hooks/use-filters';
import { AddFilterButton } from './add-filter/add-filter-button';
import { SavedFiltersButton } from './saved-filters/saved-filters-button';

interface Props {
  filterConfig: IFilterConfig;
  from: RoutesWithFiltering;
}

export const FilterControls = ({ filterConfig, from }: Props) => {
  return (
    <ButtonGroup attached>
      <AddFilterButton from={from} filterConfig={filterConfig} grouped />
      <SavedFiltersButton from={from} filterConfig={filterConfig} />
    </ButtonGroup>
  );
};
