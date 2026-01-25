import { Box, Button, Flex, Icon, Text } from '@chakra-ui/react';
import type { IOsFilter } from '@vemetric/common/filters';
import { Fragment } from 'react';
import { TbCircleDashedNumber0, TbCpu2 } from 'react-icons/tb';
import { OsIcon } from '@/components/os-icon';
import { FilterButton } from '../filter-button';
import { OsFilterForm, OsFilterTitle } from '../filter-forms/os-filter-form';

interface Props {
  filter: IOsFilter;
  onChange: (filter: IOsFilter) => void;
  onDelete: () => void;
}

export const OsFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const { osFilter = { value: [], operator: 'any' } } = filter;

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
            <OsFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete Delete
          </Button>
        </Flex>
      </Flex>
      <OsFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbCpu2 />
          <Text>OS</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {osFilter.operator}
        </Text>
        {osFilter.operator !== 'any' && (
          <Flex align="center" gap={0} flexWrap="wrap">
            {osFilter.value.length > 0 ? (
              osFilter.value.slice(0, 3).map((os, index) => (
                <Fragment key={os}>
                  {index > 0 && <>,&nbsp;</>}
                  <OsIcon key={os} osName={os} />
                </Fragment>
              ))
            ) : (
              <Icon as={TbCircleDashedNumber0} color="fg.muted" />
            )}
            {osFilter.value.length > 3 && (
              <Text fontSize="xs" fontWeight="medium">
                , ...
              </Text>
            )}
          </Flex>
        )}
      </Flex>
    </FilterButton>
  );
};
