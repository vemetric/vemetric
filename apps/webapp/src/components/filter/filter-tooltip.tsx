import { Flex, Text } from '@chakra-ui/react';
import type { IFilter } from '@vemetric/common/filters';
import type { TooltipProps } from '../ui/tooltip';
import { Tooltip } from '../ui/tooltip';

interface Props extends Omit<TooltipProps, 'content'> {
  filter: IFilter;
}

export const FilterTooltip = ({ filter, ...props }: Props) => {
  const entries = Object.entries(filter)
    .map(([key, value]) => {
      if (typeof value !== 'object') {
        return null;
      }

      if (Array.isArray(value)) {
        // TODO: here we would need to e.g. handle the toolip visualization for the event properties filter
        return null;
      }

      let name = key.replace('Filter', '');
      if (key === 'osFilter') {
        name = 'Operating System';
      }

      return (
        <Flex key={key} gap={1.5}>
          <Text textTransform="capitalize">{name}</Text>
          <Text>{value.operator}</Text>
          <Text>
            {value.operator === 'any' ? '' : Array.isArray(value.value) ? value.value.join(', ') : value.value}
          </Text>
        </Flex>
      );
    })
    .filter(Boolean);

  return (
    <Tooltip
      {...props}
      content={
        <Flex flexDir="column" gap={2}>
          {entries}
        </Flex>
      }
    />
  );
};
