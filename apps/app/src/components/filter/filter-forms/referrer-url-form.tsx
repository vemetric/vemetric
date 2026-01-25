import { Button, Flex, Grid } from '@chakra-ui/react';
import type { IReferrerUrlFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbDirectionSign } from 'react-icons/tb';
import { useFilterContext } from '../filter-context';
import { StringFilterRow } from '../filter-rows/string/string-filter-row';

export const ReferrerUrlFilterTitle = () => (
  <>
    <TbDirectionSign /> Referrer URL Filter
  </>
);

interface Props {
  filter?: IReferrerUrlFilter;
  onSubmit: (filter: IReferrerUrlFilter) => void;
  buttonText: string;
}

export const ReferrerUrlFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const { referrerUrls } = useFilterContext();
  const [filter, setFilter] = useState<IReferrerUrlFilter>(
    _filter ?? {
      type: 'referrerUrl',
      referrerUrlFilter: { operator: 'is', value: '' },
    },
  );
  const { referrerUrlFilter = { value: '', operator: 'any' } } = filter;

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
          label="Referrer URL"
          values={referrerUrls}
          filter={referrerUrlFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.referrerUrlFilter = newFilter;
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
