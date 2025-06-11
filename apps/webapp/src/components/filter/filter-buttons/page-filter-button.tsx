import { Box, Button, Flex, Text } from '@chakra-ui/react';
import type { IPageFilter } from '@vemetric/common/filters';
import { TbEye } from 'react-icons/tb';
import { FilterButton } from '../filter-button';
import { PageFilterForm, PageFilterTitle } from '../filter-forms/page-filter-form';

interface Props {
  filter: IPageFilter;
  onChange: (filter: IPageFilter) => void;
  onDelete: () => void;
}

export const PageFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const { pathFilter = { value: '', operator: 'any' } } = filter;

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
            <PageFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete
          </Button>
        </Flex>
      </Flex>
      <PageFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbEye />
          <Text>Page</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {pathFilter.operator}
        </Text>
        {pathFilter.operator !== 'any' && (
          <Text fontWeight="medium" maxW="100px" truncate>
            {pathFilter.value}
          </Text>
        )}
      </Flex>
    </FilterButton>
  );
};
