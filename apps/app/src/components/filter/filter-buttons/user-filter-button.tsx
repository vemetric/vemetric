import { Box, Button, Flex, Text } from '@chakra-ui/react';
import type { IUserFilter } from '@vemetric/common/filters';
import { TbUserSquareRounded } from 'react-icons/tb';
import { FilterButton } from '../filter-button';
import { UserFilterForm, UserFilterTitle } from '../filter-forms/user-filter-form';

interface Props {
  filter: IUserFilter;
  onChange: (filter: IUserFilter) => void;
  onDelete: () => void;
}

export const UserFilterButton = ({ filter, onChange, onDelete }: Props) => {
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
            <UserFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete
          </Button>
        </Flex>
      </Flex>
      <UserFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverProps={{ w: '200px' }} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbUserSquareRounded />
          <Text>User</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          is
        </Text>
        <Text fontWeight="medium">{filter.anonymous ? 'Anonymous' : 'Identified'}</Text>
      </Flex>
    </FilterButton>
  );
};
