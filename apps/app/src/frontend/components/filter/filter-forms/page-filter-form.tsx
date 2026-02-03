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
  onChange?: (filter: IPageFilter) => void;
  onSubmit?: (filter: IPageFilter) => void;
  buttonText?: string;
}

export const PageFilterForm = ({ filter: _filter, onChange, onSubmit, buttonText = 'Save' }: Props) => {
  const { pagePaths, origins } = useFilterContext();
  const [filter, setFilter] = useState<IPageFilter>(
    _filter ?? {
      type: 'page',
      pathFilter: { operator: 'is', value: '' },
      originFilter: undefined,
      hashFilter: undefined,
    },
  );
  const {
    pathFilter = { value: '', operator: 'any' },
    originFilter = { value: '', operator: 'any' },
    hashFilter = { value: '', operator: 'any' },
  } = filter;

  return (
    <Flex
      as={onSubmit ? 'form' : 'div'}
      p={2}
      flexDir="column"
      gap={2}
      onSubmit={
        onSubmit
          ? (e) => {
              e.preventDefault();
              onSubmit(filter);
            }
          : undefined
      }
    >
      <Grid gridTemplateColumns="1fr 1fr 4fr" gap={2} alignItems="center">
        <StringFilterRow
          label="Path"
          values={pagePaths}
          filter={pathFilter}
          onChange={(pathFilter) => {
            const newFilter = produce(filter, (draft) => {
              draft.pathFilter = pathFilter;
            });

            setFilter(newFilter);
            onChange?.(newFilter);
          }}
        />
        <StringFilterRow
          label="Origin"
          values={origins}
          filter={originFilter}
          onChange={(originFilter) => {
            const newFilter = produce(filter, (draft) => {
              draft.originFilter = originFilter;
            });

            setFilter(newFilter);
            onChange?.(newFilter);
          }}
        />
        <StringFilterRow
          label="Hash"
          filter={hashFilter}
          onChange={(hashFilter) => {
            const newFilter = produce(filter, (draft) => {
              draft.hashFilter = hashFilter;
            });

            setFilter(newFilter);
            onChange?.(newFilter);
          }}
          startAddon="#"
        />
      </Grid>
      {onSubmit && (
        <Flex justify="flex-end">
          <Button type="submit" size="2xs" rounded="sm">
            {buttonText}
          </Button>
        </Flex>
      )}
    </Flex>
  );
};
