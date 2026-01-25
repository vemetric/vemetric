import { Button, createListCollection, Flex, Grid, Tag, Text } from '@chakra-ui/react';
import type { IReferrerTypeFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbDirectionSign } from 'react-icons/tb';
import { ReferrerTypeIcon } from '~/components/referrer-icon';
import { REFERRER_TYPES } from '~/consts/referrer-types';
import { ListFilterRow } from '../filter-rows/list-filter-row';

export const ReferrerTypeFilterTitle = () => (
  <>
    <TbDirectionSign /> Referrer Type Filter
  </>
);

interface Props {
  filter?: IReferrerTypeFilter;
  onSubmit: (filter: IReferrerTypeFilter) => void;
  buttonText: string;
}

export const ReferrerTypeFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const [filter, setFilter] = useState<IReferrerTypeFilter>(
    _filter ?? {
      type: 'referrerType',
      referrerTypeFilter: { operator: 'oneOf', value: [] },
    },
  );
  const { referrerTypeFilter = { value: [], operator: 'any' } } = filter;

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
        <ListFilterRow
          label="Referrer Type"
          filter={referrerTypeFilter}
          values={createListCollection({
            items: REFERRER_TYPES.map((type) => ({
              label: (
                <Tag.Root>
                  <Tag.Label display="flex" gap={1} alignItems="center">
                    <ReferrerTypeIcon referrerType={type} />
                    <Text>{type}</Text>
                  </Tag.Label>
                </Tag.Root>
              ),
              value: type,
            })),
            itemToString: (item) => item.value,
            itemToValue: (item) => item.value,
          })}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.referrerTypeFilter = newFilter;
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
