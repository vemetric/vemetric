import { Box, Button, Flex, Icon, Text } from '@chakra-ui/react';
import { getEventName } from '@vemetric/common/event';
import type { IEventFilter } from '@vemetric/common/filters';
import { TbBolt, TbCodeDots } from 'react-icons/tb';
import { FilterButton } from '../filter-button';
import { EventFilterForm, EventFilterTitle } from '../filter-forms/event-filter-form';

interface Props {
  filter: IEventFilter;
  onChange: (filter: IEventFilter) => void;
  onDelete: () => void;
}

export const EventFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const { nameFilter = { value: '', operator: 'any' }, propertiesFilter = [] } = filter;

  const popoverContent = (
    <Box>
      <Flex
        align="center"
        fontWeight="semibold"
        fontSize="md"
        gap={1}
        p={2}
        borderBottom="1px solid"
        borderColor="border.emphasized/60"
        mb={1}
      >
        <Flex justify="space-between" w="100%">
          <Flex align="center" gap={1.5}>
            <EventFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete
          </Button>
        </Flex>
      </Flex>
      <EventFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbBolt />
          <Text>Event</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {nameFilter.operator}
        </Text>
        {nameFilter.operator !== 'any' && (
          <Text fontWeight="medium" maxW="100px" truncate>
            {getEventName(nameFilter.value)}
          </Text>
        )}
        {propertiesFilter.length > 0 && <Icon as={TbCodeDots} color="fg.muted" fontSize="md" fontWeight="medium" />}
      </Flex>
    </FilterButton>
  );
};
