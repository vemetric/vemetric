import { Box, Combobox, Input, useFilter, useListCollection } from '@chakra-ui/react';
import type { IStringFilter } from '@vemetric/common/filters';
import { Tooltip } from '@/components/ui/tooltip';

interface Props {
  id?: string;
  filter: IStringFilter;
  values?: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export const StringValueInput = ({ id, values, filter, onChange, placeholder }: Props) => {
  const { contains } = useFilter({ sensitivity: 'base' });
  const { collection, filter: filterCollection } = useListCollection({
    initialItems: values ?? [],
    filter: contains,
  });

  return (
    <>
      {filter.operator === 'any' ? (
        <Box />
      ) : values ? (
        <Combobox.Root
          size="2xs"
          inputValue={filter.value}
          inputBehavior="autohighlight"
          allowCustomValue
          collection={collection}
          onInputValueChange={(e) => {
            filterCollection(e.inputValue);
            onChange(e.inputValue);
          }}
          onBlur={() => {
            filterCollection('');
          }}
          openOnClick
        >
          <Combobox.Control>
            <Combobox.Input placeholder={placeholder} />
            <Combobox.IndicatorGroup>
              <Combobox.Trigger />
            </Combobox.IndicatorGroup>
          </Combobox.Control>
          <Combobox.Positioner>
            <Combobox.Content minW="300px">
              <Combobox.Empty>No items found</Combobox.Empty>
              {collection.items.map((item) => (
                <Tooltip content={item} key={item} positioning={{ placement: 'left' }}>
                  <Combobox.Item item={item}>
                    {item}
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                </Tooltip>
              ))}
            </Combobox.Content>
          </Combobox.Positioner>
        </Combobox.Root>
      ) : (
        <Input
          id={id}
          data-1p-ignore
          size="2xs"
          type="text"
          value={filter.value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
        />
      )}
    </>
  );
};
