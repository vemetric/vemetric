import { Box, Button, Flex, Text } from '@chakra-ui/react';
import type { IUtmTagsFilter } from '@vemetric/common/filters';
import { TbWorldQuestion } from 'react-icons/tb';
import { FilterButton } from '../filter-button';
import { UtmTagsFilterTitle, UtmTagsFilterForm } from '../filter-forms/utm-tags-filter-form';

interface Props {
  filter: IUtmTagsFilter;
  onChange: (filter: IUtmTagsFilter) => void;
  onDelete: () => void;
}

export const UtmTagsFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const {
    utmCampaignFilter = { value: '', operator: 'any' },
    utmContentFilter = { value: '', operator: 'any' },
    utmMediumFilter = { value: '', operator: 'any' },
    utmSourceFilter = { value: '', operator: 'any' },
    utmTermFilter = { value: '', operator: 'any' },
  } = filter;

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
            <UtmTagsFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete
          </Button>
        </Flex>
      </Flex>
      <UtmTagsFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  let displayFilter = utmCampaignFilter;
  let displayName = 'UTM Campaign';
  if (!filter.utmCampaignFilter || utmCampaignFilter.operator === 'any') {
    if (filter.utmContentFilter && utmContentFilter.operator !== 'any') {
      displayFilter = filter.utmContentFilter;
      displayName = 'UTM Content';
    } else if (filter.utmMediumFilter && utmMediumFilter.operator !== 'any') {
      displayFilter = filter.utmMediumFilter;
      displayName = 'UTM Medium';
    } else if (filter.utmSourceFilter && utmSourceFilter.operator !== 'any') {
      displayFilter = filter.utmSourceFilter;
      displayName = 'UTM Source';
    } else if (filter.utmTermFilter && utmTermFilter.operator !== 'any') {
      displayFilter = filter.utmTermFilter;
      displayName = 'UTM Term';
    }
  }

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbWorldQuestion />
          <Text>{displayName}</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {displayFilter.operator}
        </Text>
        {displayFilter.operator !== 'any' && (
          <Text fontWeight="medium" maxW="100px" truncate>
            {displayFilter.value}
          </Text>
        )}
      </Flex>
    </FilterButton>
  );
};
