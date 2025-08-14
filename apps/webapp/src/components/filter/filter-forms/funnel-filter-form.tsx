import { Box, Button, Flex, Grid, Text, Select, createListCollection } from '@chakra-ui/react';
import { Link } from '@tanstack/react-router';
import type { IFunnelFilter } from '@vemetric/common/filters';
import React, { useState } from 'react';
import { TbChartFunnel } from 'react-icons/tb';
import { EmptyState } from '@/components/ui/empty-state';
import { useProjectContext } from '@/contexts/project-context';
import { useFilterContext } from '../filter-context';

export const FunnelFilterTitle = () => (
  <>
    <TbChartFunnel />
    Funnel Filter
  </>
);

interface Props {
  filter?: IFunnelFilter;
  onSubmit: (filter: IFunnelFilter) => void;
  buttonText: string;
}

export const FunnelFilterForm: React.FC<Props> = ({ filter: _filter, onSubmit, buttonText }) => {
  const { projectId } = useProjectContext();
  const { funnels = [] } = useFilterContext();

  const [filter, setFilter] = useState<IFunnelFilter>(
    _filter ?? {
      type: 'funnel',
      id: funnels[0]?.id || '',
      step: 0,
      operator: 'completed',
    },
  );

  const selectedFunnel = funnels.find((f) => f.id === filter.id);
  const funnelSteps = selectedFunnel?.steps || [];

  const funnelCollection = createListCollection({
    items: funnels.map((funnel) => ({ label: funnel.name, value: funnel.id })),
  });

  const stepCollection = createListCollection({
    items: funnelSteps.map((step: any, index: number) => ({
      label: `Step ${index + 1}` + (step.name ? `: ${step.name}` : ''),
      value: String(index),
    })),
  });

  const operatorCollection = createListCollection({
    items: [
      { label: 'Completed the step', value: 'completed' },
      { label: 'Did not complete the step', value: 'notCompleted' },
    ],
  });

  const isValid = filter.id && filter.step >= 0 && funnelSteps.length > filter.step;

  if (funnels.length === 0) {
    return (
      <EmptyState icon={<TbChartFunnel />} title="No funnels available">
        {projectId && (
          <Button asChild size="sm" mt={4} _hover={{ textDecoration: 'none' }}>
            <Link to="/p/$projectId/funnels" params={{ projectId }}>
              Create your first funnel
            </Link>
          </Button>
        )}
      </EmptyState>
    );
  }

  return (
    <Flex
      as="form"
      p={2}
      flexDir="column"
      gap={2}
      onSubmit={(e) => {
        e.preventDefault();
        if (isValid) {
          onSubmit(filter);
        }
      }}
    >
      <Box p={2}>
        <Text fontSize="sm" mb={3} color="fg.muted">
          Filter users based on their completion of a specific step in a funnel
        </Text>

        <Grid gap={3}>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1}>
              Funnel
            </Text>
            <Select.Root
              collection={funnelCollection}
              value={filter.id ? [filter.id] : []}
              onValueChange={({ value }) => {
                const newFunnelId = value[0];
                setFilter({
                  ...filter,
                  id: newFunnelId,
                  step: 0, // Reset to first step when funnel changes
                });
              }}
              size="sm"
            >
              <Select.HiddenSelect />
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText placeholder="Choose a funnel" />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>
              <Select.Positioner>
                <Select.Content>
                  {funnelCollection.items.map((funnel) => (
                    <Select.Item key={funnel.value} item={funnel.value}>
                      {funnel.label}
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Select.Root>
          </Box>

          {selectedFunnel && (
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={1}>
                Step
              </Text>
              <Select.Root
                collection={stepCollection}
                value={[String(filter.step)]}
                onValueChange={({ value }) => {
                  setFilter({
                    ...filter,
                    step: Number(value[0]),
                  });
                }}
                size="sm"
              >
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger>
                    <Select.ValueText placeholder="Choose a step" />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Select.Positioner>
                  <Select.Content>
                    {stepCollection.items.map((step) => (
                      <Select.Item key={step.value} item={step.value}>
                        {step.label}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Select.Root>
            </Box>
          )}

          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1}>
              Condition
            </Text>
            <Select.Root
              collection={operatorCollection}
              value={[filter.operator]}
              onValueChange={({ value }) => {
                setFilter({
                  ...filter,
                  operator: value[0] as 'completed' | 'notCompleted',
                });
              }}
              size="sm"
            >
              <Select.HiddenSelect />
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>
              <Select.Positioner>
                <Select.Content>
                  {operatorCollection.items.map((operator) => (
                    <Select.Item key={operator.value} item={operator.value}>
                      {operator.label}
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Select.Root>
          </Box>
        </Grid>
      </Box>

      <Flex justify="flex-end">
        <Button type="submit" size="2xs" rounded="sm" disabled={!isValid}>
          {buttonText}
        </Button>
      </Flex>
    </Flex>
  );
};
