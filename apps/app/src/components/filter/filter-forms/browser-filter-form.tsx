import { Button, createListCollection, Flex, Grid, Text } from '@chakra-ui/react';
import type { IBrowserFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbBrowser } from 'react-icons/tb';
import { BrowserIcon } from '@/components/browser-icon';
import { useFilterContext } from '../filter-context';
import { ListFilterRow } from '../filter-rows/list-filter-row';

export const BrowserFilterTitle = () => (
  <>
    <TbBrowser />
    Browser Filter
  </>
);

interface Props {
  filter?: IBrowserFilter;
  onSubmit: (filter: IBrowserFilter) => void;
  buttonText: string;
}

export const BrowserFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const { browserNames } = useFilterContext();
  const [filter, setFilter] = useState<IBrowserFilter>(
    _filter ?? {
      type: 'browser',
      browserFilter: { value: [], operator: 'oneOf' },
    },
  );
  const { browserFilter = { value: [], operator: 'any' } } = filter;

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
          label="Browser"
          values={createListCollection({
            items: browserNames.map((name) => ({
              label: (
                <Flex gap={1.5} align="center">
                  <BrowserIcon browserName={name} />
                  <Text className="value-hidden">{name}</Text>
                </Flex>
              ),
              value: name,
            })),
            itemToString: (item) => item.value,
            itemToValue: (item) => item.value,
          })}
          filter={browserFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.browserFilter = newFilter;
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
