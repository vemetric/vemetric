import { Button, Stack, Flex, Icon, Text, Box } from '@chakra-ui/react';
import { type FunnelStep } from '@vemetric/common/funnel';
import { TbPlus } from 'react-icons/tb';
import { FunnelStepForm } from './funnel-step-form';

interface FunnelStepBuilderProps {
  steps: FunnelStep[];
  onChange: (steps: FunnelStep[]) => void;
  disabled?: boolean;
}

export const FunnelStepBuilder = ({ steps, onChange, disabled }: FunnelStepBuilderProps) => {
  const addStep = () => {
    const newStep: FunnelStep = {
      name: '',
      filter: {
        type: 'page',
        pathFilter: {
          value: '',
          operator: 'is',
        },
        originFilter: {
          value: '',
          operator: 'any',
        },
      },
    };
    onChange([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      onChange(steps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index: number, updates: Partial<FunnelStep>) => {
    const newSteps = [...steps];
    const currentStep = newSteps[index];

    // Handle type switching - reset fields when type changes
    if (updates.filter?.type && updates.filter.type !== currentStep.filter.type) {
      if (updates.filter.type === 'page') {
        newSteps[index] = {
          name: currentStep.name,
          filter: {
            type: 'page',
            pathFilter: {
              value: '',
              operator: 'is',
            },
            originFilter: {
              value: '',
              operator: 'any',
            },
          },
        };
      } else {
        newSteps[index] = {
          name: currentStep.name,
          filter: {
            type: 'event',
            nameFilter: {
              value: '',
              operator: 'is',
            },
            propertiesFilter: [],
          },
        };
      }
    } else {
      newSteps[index] = { ...currentStep, ...updates } as FunnelStep;
    }

    onChange(newSteps);
  };

  return (
    <Stack gap={4}>
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="medium">
          Steps
        </Text>
        <Button size="xs" variant="outline" onClick={addStep} disabled={disabled || steps.length >= 10}>
          <Icon as={TbPlus} />
          Add Step
        </Button>
      </Flex>

      <Stack gap={3}>
        {steps.map((step, index) => (
          <FunnelStepForm
            key={index}
            disabled={disabled}
            index={index}
            isLastStep={index === steps.length - 1}
            step={step}
            updateStep={(updates) => updateStep(index, updates)}
            removeStep={steps.length > 1 ? () => removeStep(index) : undefined}
            moveStep={(direction) => {
              const newSteps = [...steps];
              if (direction === 'up') {
                [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
                onChange(newSteps);
              } else if (direction === 'down') {
                [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
                onChange(newSteps);
              }
            }}
          />
        ))}
      </Stack>

      {steps.length === 0 && (
        <Box textAlign="center" py={6} color="fg.muted">
          <Text fontSize="sm">No steps added yet</Text>
          <Text fontSize="xs" mt={1}>
            Add at least one step to create your funnel
          </Text>
        </Box>
      )}
    </Stack>
  );
};
