import { Box, Button, Flex, Icon, Text } from '@chakra-ui/react';
import type { IBrowserFilter } from '@vemetric/common/filters';
import { Fragment } from 'react';
import { TbCircleDashedNumber0, TbBrowser } from 'react-icons/tb';
import { BrowserIcon } from '@/components/browser-icon';
import { FilterButton } from '../filter-button';
import { BrowserFilterForm, BrowserFilterTitle } from '../filter-forms/browser-filter-form';

interface Props {
  filter: IBrowserFilter;
  onChange: (filter: IBrowserFilter) => void;
  onDelete: () => void;
}

export const BrowserFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const { browserFilter = { value: [], operator: 'any' } } = filter;

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
            <BrowserFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete Delete
          </Button>
        </Flex>
      </Flex>
      <BrowserFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbBrowser />
          <Text>Browser</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {browserFilter.operator}
        </Text>
        {browserFilter.operator !== 'any' && (
          <Flex align="center" gap={0} flexWrap="wrap">
            {browserFilter.value.length > 0 ? (
              browserFilter.value.slice(0, 3).map((browser, index) => (
                <Fragment key={browser}>
                  {index > 0 && <>,&nbsp;</>}
                  <BrowserIcon key={browser} browserName={browser} />
                </Fragment>
              ))
            ) : (
              <Icon as={TbCircleDashedNumber0} color="fg.muted" />
            )}
            {browserFilter.value.length > 3 && (
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
