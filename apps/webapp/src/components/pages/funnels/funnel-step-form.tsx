import { Button, Field, Input, Stack, Flex, Icon, Card, Text, IconButton } from '@chakra-ui/react';
import type { FunnelStep } from '@vemetric/common/funnel';
import { useState } from 'react';
import { TbGripVertical, TbTrash, TbPencil } from 'react-icons/tb';
import { EventFilterForm } from '@/components/filter/filter-forms/event-filter-form';
import { PageFilterForm } from '@/components/filter/filter-forms/page-filter-form';
import { StepTypeSelect } from './step-type-select';

interface FunnelStepFormProps {
  index: number;
  step: FunnelStep;
  updateStep: (updates: Partial<FunnelStep>) => void;
  removeStep?: () => void;
  disabled?: boolean;
}

export const FunnelStepForm = ({ index, step, updateStep, removeStep, disabled }: FunnelStepFormProps) => {
  const [editStepName, setEditStepName] = useState(false);

  return (
    <Card.Root size="sm" variant="outline">
      <Card.Header borderBottom="1px solid" borderColor="border.emphasized/50" py={2.5}>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={2} w="100%" maxW="100%">
            <Icon as={TbGripVertical} color="fg.muted" />
            {editStepName ? (
              <Input
                className="funnel-step-name"
                autoFocus
                w="auto"
                flexGrow={1}
                size="2xs"
                placeholder={`Step ${index + 1}`}
                value={step.name}
                onChange={(e) => updateStep({ name: e.target.value })}
                onBlur={() => setEditStepName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    setEditStepName(false);
                  }
                }}
              />
            ) : (
              <>
                <Text fontSize="sm" fontWeight="medium" my={1} truncate>
                  {step.name || `Step ${index + 1}`}
                </Text>
                <IconButton size="2xs" variant="ghost" colorPalette="gray" onClick={() => setEditStepName(true)}>
                  <Icon as={TbPencil} />
                </IconButton>
              </>
            )}
          </Flex>
          {removeStep && (
            <Button size="xs" variant="ghost" colorPalette="red" onClick={() => removeStep()} disabled={disabled}>
              <Icon as={TbTrash} />
            </Button>
          )}
        </Flex>
      </Card.Header>
      <Card.Body p={4}>
        <Stack gap={3}>
          <Field.Root orientation="horizontal" gap={4}>
            <Field.Label fontSize="sm" flex="1">
              Type
            </Field.Label>
            <StepTypeSelect
              value={step.filter.type}
              onChange={(type) => updateStep({ filter: { type } })}
              disabled={disabled}
            />
          </Field.Root>

          <Card.Root variant="outline">
            {step.filter.type === 'page' ? (
              <PageFilterForm filter={step.filter} onChange={(filter) => updateStep({ filter })} />
            ) : (
              <EventFilterForm filter={step.filter} onChange={(filter) => updateStep({ filter })} />
            )}
          </Card.Root>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
};
