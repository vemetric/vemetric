import { Button, createListCollection, Flex, Grid, Text } from '@chakra-ui/react';
import type { IOsFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbCpu2 } from 'react-icons/tb';
import { OsIcon } from '@/components/os-icon';
import { useFilterContext } from '../filter-context';
import { ListFilterRow } from '../filter-rows/list-filter-row';

export const OsFilterTitle = () => (
  <>
    <TbCpu2 />
    Operating System Filter
  </>
);

interface Props {
  filter?: IOsFilter;
  onSubmit: (filter: IOsFilter) => void;
  buttonText: string;
}

export const OsFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const { osNames } = useFilterContext();
  const [filter, setFilter] = useState<IOsFilter>(
    _filter ?? {
      type: 'os',
      osFilter: { value: [], operator: 'oneOf' },
    },
  );
  const { osFilter = { value: [], operator: 'any' } } = filter;

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
      <Grid gridTemplateColumns="1fr 1fr 4fr" gap={2} p={2} alignItems="center">
        <ListFilterRow
          label="OS"
          values={createListCollection({
            items: osNames.map((name) => ({
              label: (
                <Flex gap={1.5} align="center">
                  <OsIcon osName={name} />
                  <Text className="value-hidden">{name}</Text>
                </Flex>
              ),
              value: name,
            })),
            itemToString: (item) => item.value,
            itemToValue: (item) => item.value,
          })}
          filter={osFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.osFilter = newFilter;
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
