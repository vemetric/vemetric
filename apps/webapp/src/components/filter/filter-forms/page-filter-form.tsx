import { Button, Flex, Grid } from '@chakra-ui/react';
import type { IPageFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbEye } from 'react-icons/tb';
import { useFilterContext } from '../filter-context';
import { StringFilterRow } from '../filter-rows/string/string-filter-row';

export const PageFilterTitle = () => (
  <>
    <TbEye /> Page Filter
  </>
);

interface Props {
  filter?: IPageFilter;
  onSubmit: (filter: IPageFilter) => void;
  buttonText: string;
}

export const PageFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const { pagePaths, origins } = useFilterContext();
  const [filter, setFilter] = useState<IPageFilter>(
    _filter ?? {
      type: 'page',
      pathFilter: { operator: 'is', value: '' },
      originFilter: undefined,
    },
  );
  const { pathFilter = { value: '', operator: 'any' }, originFilter = { value: '', operator: 'any' } } = filter;

  return (
    <Flex
      as="form"
      p={2}
      flexDir="column"
      gap={2}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(filter);
      }}
    >
      <Grid gridTemplateColumns="1fr 1fr 4fr" gap={2} alignItems="center">
        <StringFilterRow
          label="Path"
          values={pagePaths}
          filter={pathFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.pathFilter = newFilter;
              }),
            );
          }}
        />
        <StringFilterRow
          label="Origin"
          values={origins}
          filter={originFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.originFilter = newFilter;
              }),
            );
          }}
        />
      </Grid>
      <Flex justify="flex-end">
        <Button type="submit" size="2xs" rounded="sm">
          {buttonText}
        </Button>
      </Flex>
    </Flex>
  );
};
