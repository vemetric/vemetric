import { Button, Flex, Grid } from '@chakra-ui/react';
import type { IUserFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbUserSquareRounded } from 'react-icons/tb';
import { BooleanFilterRow } from '../filter-rows/boolean-filter-row';

export const UserFilterTitle = () => (
  <>
    <TbUserSquareRounded /> User Filter
  </>
);

interface Props {
  filter?: IUserFilter;
  onSubmit: (filter: IUserFilter) => void;
  buttonText: string;
}

export const UserFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const [filter, setFilter] = useState<IUserFilter>(
    _filter ?? {
      type: 'user',
      anonymous: true,
    },
  );

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
        <BooleanFilterRow
          label="Anonymous"
          value={filter.anonymous}
          onChange={(newValue) => {
            setFilter(
              produce(filter, (draft) => {
                draft.anonymous = newValue;
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
