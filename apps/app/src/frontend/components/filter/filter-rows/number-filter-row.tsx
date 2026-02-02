import { Box, Flex, NumberInput, Text } from '@chakra-ui/react';
import { numberOperatorValues, type INumberFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useId } from 'react';
import { OperatorButton } from '../operator-button';

interface Props {
  label: string;
  filter: INumberFilter;
  onChange: (filter: INumberFilter) => void;
}

export const NumberFilterRow = ({ filter, onChange, label }: Props) => {
  const id = useId();

  return (
    <>
      <Text asChild fontWeight="medium">
        <label htmlFor={id}>{label}</label>
      </Text>
      <Flex justify="center">
        <OperatorButton
          operator={filter.operator}
          operators={numberOperatorValues}
          onChange={(operator) => {
            onChange(
              produce(filter, (draft) => {
                draft.operator = operator;
              }),
            );
          }}
        />
      </Flex>
      {filter.operator === 'any' ? (
        <Box />
      ) : (
        <NumberInput.Root
          id={id}
          size="xs"
          value={filter.value.toString()}
          onChange={(e) => {
            onChange(
              produce(filter, (draft) => {
                if (!(e.target instanceof HTMLInputElement)) {
                  return;
                }

                const newValue = Number(e.target.value);
                if (isNaN(newValue)) {
                  return;
                }

                draft.value = newValue;
              }),
            );
          }}
        >
          <NumberInput.Input />
        </NumberInput.Root>
      )}
    </>
  );
};
