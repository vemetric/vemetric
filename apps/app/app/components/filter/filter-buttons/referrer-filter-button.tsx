import { Box, Button, Flex, Text } from '@chakra-ui/react';
import type { IReferrerFilter } from '@vemetric/common/filters';
import { TbDirectionSign } from 'react-icons/tb';
import { ReferrerIcon } from '~/components/referrer-icon';
import { REFERRER_URL_MAP } from '~/consts/referrer-types';
import { FilterButton } from '../filter-button';
import { ReferrerFilterForm, ReferrerFilterTitle } from '../filter-forms/referrer-filter-form';

interface Props {
  filter: IReferrerFilter;
  onChange: (filter: IReferrerFilter) => void;
  onDelete: () => void;
}

export const ReferrerFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const { referrerFilter = { value: '', operator: 'any' } } = filter;

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
            <ReferrerFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete
          </Button>
        </Flex>
      </Flex>
      <ReferrerFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbDirectionSign />
          <Text>Referrer</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {referrerFilter.operator}
        </Text>
        {referrerFilter.operator !== 'any' && (
          <Flex align="center" gap={1}>
            <ReferrerIcon
              source="referrer"
              referrer={referrerFilter.value}
              referrerUrl={
                REFERRER_URL_MAP[referrerFilter.value as keyof typeof REFERRER_URL_MAP] ?? referrerFilter.value
              }
            />
            <Text fontWeight="medium" maxW="100px" truncate>
              {referrerFilter.value || 'Direct / None'}
            </Text>
          </Flex>
        )}
      </Flex>
    </FilterButton>
  );
};
