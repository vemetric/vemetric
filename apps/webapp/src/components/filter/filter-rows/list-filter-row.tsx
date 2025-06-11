import type { ListCollection } from '@chakra-ui/react';
import { Box, Flex, Portal, Select, Text, Span } from '@chakra-ui/react';
import { listOperatorValues, type IListFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { Fragment, type ReactNode } from 'react';
import { OperatorButton } from '../operator-button';

interface Props {
  label: string;
  filter: IListFilter;
  values: ListCollection<{ label: ReactNode; value: string }>;
  onChange: (filter: IListFilter) => void;
}

export const ListFilterRow = ({ filter, onChange, label, values }: Props) => {
  return (
    <>
      <Text fontWeight="semibold">{label}</Text>
      <Flex justify="center">
        <OperatorButton
          operator={filter.operator}
          operators={listOperatorValues}
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
        <Select.Root
          multiple
          collection={values}
          size="xs"
          value={filter.value}
          closeOnSelect
          onValueChange={({ value }) =>
            onChange(
              produce(filter, (draft) => {
                draft.value = value;
              }),
            )
          }
        >
          <Select.HiddenSelect />
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder={`Select ${label}`}>
                <Flex align="center" flexWrap="wrap" rowGap={1} css={{ '& .value-hidden': { display: 'none' } }} py={1}>
                  {filter.value.map((value, index) => (
                    <Fragment key={value}>
                      {index > 0 && <Span>,&nbsp;</Span>}
                      <Span className={value === 'any' ? 'value-hidden' : ''}>
                        {values.items.find((item) => item.value === value)?.label}
                      </Span>
                    </Fragment>
                  ))}
                </Flex>
              </Select.ValueText>
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content zIndex="1502!important">
                {values.items.map(({ value, label }) => (
                  <Select.Item item={value} key={value}>
                    {label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>
      )}
    </>
  );
};
