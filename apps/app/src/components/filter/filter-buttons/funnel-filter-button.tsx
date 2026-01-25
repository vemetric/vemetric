import { Box, Button, Flex, Icon, Text } from '@chakra-ui/react';
import type { IFunnelFilter } from '@vemetric/common/filters';
import React from 'react';
import { TbChartFunnel } from 'react-icons/tb';
import { FilterButton } from '../filter-button';
import { useFilterContext } from '../filter-context';
import { FunnelFilterForm, FunnelFilterTitle } from '../filter-forms/funnel-filter-form';

interface Props {
  filter: IFunnelFilter;
  onChange: (filter: IFunnelFilter) => void;
  onDelete: () => void;
}

export const FunnelFilterButton: React.FC<Props> = ({ filter, onChange, onDelete }) => {
  const { funnels = [] } = useFilterContext();

  const funnel = funnels.find((f) => f.id === filter.id);
  const isLastStep = filter.step === (funnel?.steps.length ?? 0) - 1;
  const funnelName = funnel?.name || 'Unknown Funnel';

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
            <FunnelFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete
          </Button>
        </Flex>
      </Flex>
      <FunnelFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <Icon as={TbChartFunnel} />
          <Text>Funnel</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {filter.operator === 'completed' ? 'completed' : 'not completed'}
        </Text>
        <Flex gap="0.5" align="center">
          <Text fontSize="xs" maxW="100px" truncate>
            {funnelName}
          </Text>
          {!isLastStep && (
            <Text fontSize="2xs" fontStyle="italic">
              (Step {filter.step + 1})
            </Text>
          )}
        </Flex>
      </Flex>
    </FilterButton>
  );
};
