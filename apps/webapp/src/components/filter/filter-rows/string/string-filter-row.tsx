import { Flex, Text } from '@chakra-ui/react';
import { type IStringFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useId } from 'react';
import { StringOperatorButton } from './string-operator-button';
import { StringValueInput } from './string-value-input';

interface Props {
  label: string;
  filter: IStringFilter;
  values?: string[];
  onChange: (filter: IStringFilter) => void;
}

export const StringFilterRow = ({ filter, onChange, label, values }: Props) => {
  const id = useId();

  return (
    <>
      <Text asChild fontWeight="medium">
        <label htmlFor={id}>{label}</label>
      </Text>
      <Flex justify="center">
        <StringOperatorButton
          operator={filter.operator}
          onChange={(operator) => {
            onChange(
              produce(filter, (draft) => {
                draft.operator = operator;
              }),
            );
          }}
        />
      </Flex>
      <StringValueInput
        id={id}
        values={values}
        filter={filter}
        onChange={(value) => {
          onChange(
            produce(filter, (draft) => {
              draft.value = value;
            }),
          );
        }}
      />
    </>
  );
};
