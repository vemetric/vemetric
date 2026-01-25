import { Box, SegmentGroup } from '@chakra-ui/react';
import { MenuRoot, MenuTrigger, MenuContent, MenuRadioItemGroup, MenuRadioItem } from './ui/menu';

interface Props<
  TValues extends Record<string, Record<string, string>>,
  TValue extends {
    segment: keyof TValues;
  } & {
    [K in keyof TValues]: keyof TValues[K];
  },
> {
  values: TValues;
  value: TValue;
  onChange: (value: TValue) => void;
  size?: SegmentGroup.RootProps['size'];
}

export const SegmentedMenu = <
  TValues extends Record<string, Record<string, string>>,
  TValue extends {
    segment: keyof TValues;
  } & {
    [K in keyof TValues]: keyof TValues[K];
  },
>(
  props: Props<TValues, TValue>,
) => {
  const { values, value: sourceValue, onChange: setSourceValue } = props;

  return (
    <SegmentGroup.Root size={props.size} value={sourceValue.segment as string}>
      <SegmentGroup.Indicator />
      {Object.entries(values)
        .filter(([key]) => key !== 'segment')
        .map(([key, value]) => (
          <MenuRoot key={key} positioning={{ placement: 'bottom-end' }}>
            <SegmentGroup.Item value={key}>
              <MenuTrigger asChild>
                <Box pos="absolute" inset="0" />
              </MenuTrigger>
              <SegmentGroup.ItemText>
                {value[sourceValue[key as keyof typeof sourceValue] as keyof typeof value]}
              </SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
            <MenuContent>
              <MenuRadioItemGroup
                value={
                  sourceValue.segment === key ? (sourceValue[key as keyof typeof sourceValue] as string) : undefined
                }
                onValueChange={({ value }) => setSourceValue({ ...sourceValue, segment: key, [key]: value })}
              >
                {Object.entries(value).map(([key, value]) => (
                  <MenuRadioItem key={key} value={key}>
                    {value}
                  </MenuRadioItem>
                ))}
              </MenuRadioItemGroup>
            </MenuContent>
          </MenuRoot>
        ))}
    </SegmentGroup.Root>
  );
};
