import { Box, Combobox, Input, InputGroup, useFilter, useListCollection } from '@chakra-ui/react';
import type { IStringFilter } from '@vemetric/common/filters';
import { Tooltip } from '@/components/ui/tooltip';

interface Props {
  id?: string;
  filter: IStringFilter;
  values?: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  startAddon?: React.ReactNode;
}

export const StringValueInput = (props: Props) => {
  const { id, values, filter, onChange, placeholder } = props;

  const { contains } = useFilter({ sensitivity: 'base' });
  const { collection, filter: filterCollection } = useListCollection({
    initialItems: values ?? [],
    filter: contains,
    limit: 20,
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
        <InputGroup css={{ '& [data-group-item]': { px: 2 } }} startAddon={props.startAddon}>
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
        </InputGroup>
      )}
    </>
  );
};
