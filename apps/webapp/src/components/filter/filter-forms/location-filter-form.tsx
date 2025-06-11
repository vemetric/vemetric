import { Button, createListCollection, Flex, Grid, Text } from '@chakra-ui/react';
import { COUNTRIES } from '@vemetric/common/countries';
import type { ILocationFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbMap2 } from 'react-icons/tb';
import { CountryFlag } from '@/components/country-flag';
import { useFilterContext } from '../filter-context';
import { ListFilterRow } from '../filter-rows/list-filter-row';

export const LocationFilterTitle = () => (
  <>
    <TbMap2 />
    Location Filter
  </>
);

interface Props {
  filter?: ILocationFilter;
  onSubmit: (filter: ILocationFilter) => void;
  buttonText: string;
}

export const LocationFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const { countryCodes } = useFilterContext();
  const [filter, setFilter] = useState<ILocationFilter>(
    _filter ?? {
      type: 'location',
      countryFilter: { value: [], operator: 'oneOf' },
    },
  );
  const { countryFilter = { value: [], operator: 'any' } } = filter;

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
          label="Country"
          values={createListCollection({
            items: countryCodes.map((code) => ({
              label: (
                <Flex gap={1.5} align="center">
                  <CountryFlag countryCode={code} />
                  <Text className="value-hidden">{COUNTRIES[code as keyof typeof COUNTRIES] ?? 'Unknown'}</Text>
                </Flex>
              ),
              value: code,
            })),
            itemToString: (item) => COUNTRIES[item.value as keyof typeof COUNTRIES] ?? 'Unknown',
            itemToValue: (item) => item.value,
          })}
          filter={countryFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.countryFilter = newFilter;
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
