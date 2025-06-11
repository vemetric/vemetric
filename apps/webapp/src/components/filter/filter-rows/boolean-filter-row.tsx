import { Flex, Text, Checkbox } from '@chakra-ui/react';

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export const BooleanFilterRow = ({ value, onChange, label }: Props) => {
  return (
    <>
      <Text asChild fontWeight="semibold">
        <label
          onClick={() => {
            onChange(!value);
          }}
        >
          {label}
        </label>
      </Text>
      <Flex justify="center"></Flex>
      <Flex justify="flex-end">
        <Checkbox.Root
          size="sm"
          colorPalette="purple"
          checked={value}
          onCheckedChange={() => {
            onChange(!value);
          }}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
      </Flex>
    </>
  );
};
