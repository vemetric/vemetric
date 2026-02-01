import { Button, Flex, Grid } from '@chakra-ui/react';
import type { IReferrerFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbDirectionSign } from 'react-icons/tb';
import { useFilterContext } from '../filter-context';
import { StringFilterRow } from '../filter-rows/string/string-filter-row';

export const ReferrerFilterTitle = () => (
  <>
    <TbDirectionSign /> Referrer Filter
  </>
);

interface Props {
  filter?: IReferrerFilter;
  onSubmit: (filter: IReferrerFilter) => void;
  buttonText: string;
}

export const ReferrerFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const { referrers } = useFilterContext();
  const [filter, setFilter] = useState<IReferrerFilter>(
    _filter ?? {
      type: 'referrer',
      referrerFilter: { operator: 'is', value: '' },
    },
  );
  const { referrerFilter = { value: '', operator: 'any' } } = filter;

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
          label="Referrer"
          values={referrers}
          filter={referrerFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.referrerFilter = newFilter;
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
