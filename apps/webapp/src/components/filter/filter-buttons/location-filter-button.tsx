import { Box, Button, Flex, Icon, Text } from '@chakra-ui/react';
import type { ILocationFilter } from '@vemetric/common/filters';
import { Fragment } from 'react';
import { TbCircleDashedNumber0, TbMap2 } from 'react-icons/tb';
import { CountryFlag } from '../../country-flag';
import { FilterButton } from '../filter-button';
import { LocationFilterForm, LocationFilterTitle } from '../filter-forms/location-filter-form';

interface Props {
  filter: ILocationFilter;
  onChange: (filter: ILocationFilter) => void;
  onDelete: () => void;
}

export const LocationFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const { countryFilter = { value: [], operator: 'any' } } = filter;

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
            <LocationFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete Delete
          </Button>
        </Flex>
      </Flex>
      <LocationFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbMap2 />
          <Text>Location</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {countryFilter.operator}
        </Text>
        {countryFilter.operator !== 'any' && (
          <Flex align="center" gap={0} flexWrap="wrap">
            {countryFilter.value.length > 0 ? (
              countryFilter.value.slice(0, 3).map((code, index) => (
                <Fragment key={code}>
                  {index > 0 && <>,&nbsp;</>}
                  <CountryFlag key={code} countryCode={code} />
                </Fragment>
              ))
            ) : (
              <Icon as={TbCircleDashedNumber0} color="fg.muted" />
            )}
            {countryFilter.value.length > 3 && (
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
