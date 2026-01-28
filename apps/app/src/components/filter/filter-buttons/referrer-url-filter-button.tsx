import { Box, Button, Flex, Text } from '@chakra-ui/react';
import type { IReferrerUrlFilter } from '@vemetric/common/filters';
import { TbDirectionSign } from 'react-icons/tb';
import { FilterButton } from '../filter-button';
import { ReferrerUrlFilterTitle, ReferrerUrlFilterForm } from '../filter-forms/referrer-url-form';

interface Props {
  filter: IReferrerUrlFilter;
  onChange: (filter: IReferrerUrlFilter) => void;
  onDelete: () => void;
}

export const ReferrerUrlFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const { referrerUrlFilter = { value: '', operator: 'any' } } = filter;

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
            <ReferrerUrlFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete
          </Button>
        </Flex>
      </Flex>
      <ReferrerUrlFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbDirectionSign />
          <Text>Referrer&nbsp;URL</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {referrerUrlFilter.operator}
        </Text>
        {referrerUrlFilter.operator !== 'any' && (
          <Text fontWeight="medium" maxW="100px" truncate>
            {referrerUrlFilter.value}
          </Text>
        )}
      </Flex>
    </FilterButton>
  );
};
