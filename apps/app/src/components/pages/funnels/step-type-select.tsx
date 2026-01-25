import { createListCollection, Flex, Icon, Select, useSelectContext } from '@chakra-ui/react';
import { TbBolt, TbEye } from 'react-icons/tb';

const stepTypes = createListCollection({
  items: [
    { label: 'Page View', value: 'page', icon: TbEye },
    { label: 'Event', value: 'event', icon: TbBolt },
  ],
});

const ValueText = () => {
  const select = useSelectContext();
  const items = select.selectedItems as Array<{ label: string; icon: React.ElementType }>;
  const { label, icon } = items[0];

  return (
    <Select.ValueText placeholder="Select type">
      <Flex align="center" gap={2}>
        <Icon as={icon} />
        {label}
      </Flex>
    </Select.ValueText>
  );
};

interface Props {
  value: 'page' | 'event';
  onChange: (value: 'page' | 'event') => void;
  disabled?: boolean;
}

export const StepTypeSelect = ({ value, onChange, disabled }: Props) => {
  return (
    <Select.Root
      size="xs"
      value={[value]}
      onValueChange={({ value }) => onChange(value[0] as 'page' | 'event')}
      disabled={disabled}
      collection={stepTypes}
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger>
          <ValueText />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          {stepTypes.items.map((item) => (
            <Select.Item key={item.value} item={item}>
              <Flex align="center" gap={2}>
                <Icon as={item.icon} />
                {item.label}
              </Flex>
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  );
};
