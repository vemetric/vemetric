import { Box, Button, Flex, Icon, Tag, Text } from '@chakra-ui/react';
import type { IReferrerTypeFilter } from '@vemetric/common/filters';
import { Fragment } from 'react';
import { TbCircleDashedNumber0, TbDirectionSign } from 'react-icons/tb';
import { ReferrerTypeIcon } from '~/components/referrer-icon';
import { FilterButton } from '../filter-button';
import { ReferrerTypeFilterForm, ReferrerTypeFilterTitle } from '../filter-forms/referrer-type-form';

interface Props {
  filter: IReferrerTypeFilter;
  onChange: (filter: IReferrerTypeFilter) => void;
  onDelete: () => void;
}

export const ReferrerTypeFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const { referrerTypeFilter = { value: [], operator: 'any' } } = filter;

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
            <ReferrerTypeFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete
          </Button>
        </Flex>
      </Flex>
      <ReferrerTypeFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbDirectionSign />
          <Text>Referrer&nbsp;Type</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {referrerTypeFilter.operator}
        </Text>
        {referrerTypeFilter.operator !== 'any' && (
          <Flex align="center" gap={0} flexWrap="wrap">
            {referrerTypeFilter.value.length > 0 ? (
              referrerTypeFilter.value.slice(0, 3).map((type, index) => (
                <Fragment key={type}>
                  {index > 0 && <>,&nbsp;</>}
                  <Tag.Root key={type} p="0.5">
                    <Tag.Label>
                      <ReferrerTypeIcon referrerType={type} />
                    </Tag.Label>
                  </Tag.Root>
                </Fragment>
              ))
            ) : (
              <Icon as={TbCircleDashedNumber0} color="fg.muted" />
            )}
            {referrerTypeFilter.value.length > 3 && (
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
