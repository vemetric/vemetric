import type { BoxProps } from '@chakra-ui/react';
import { Button, Field, Input, Stack, Flex, Icon, Card, Text, IconButton, Box } from '@chakra-ui/react';
import type { FunnelStep } from '@vemetric/common/funnel';
import { useState } from 'react';
import { TbGripVertical, TbTrash, TbPencil, TbChevronUp, TbChevronDown } from 'react-icons/tb';
import { EventFilterForm } from '~/components/filter/filter-forms/event-filter-form';
import { PageFilterForm } from '~/components/filter/filter-forms/page-filter-form';
import { Tooltip } from '~/components/ui/tooltip';
import { StepTypeSelect } from './step-type-select';

interface MoveIconButtonProps extends BoxProps {
  disabled: boolean;
  tooltipContent: string;
}

const MoveIconButton = ({ disabled, tooltipContent, children, ...props }: MoveIconButtonProps) => (
  <Tooltip disabled={disabled} content={tooltipContent} positioning={{ placement: 'left' }}>
    <Box
      asChild
      pos="absolute"
      left="14px"
      rounded="sm"
      color="fg.muted"
      transition="all 0.2s ease-in-out"
      transform="translateY(5px)"
      opacity="0"
      outline="1px solid transparent"
      _groupHover={{ transform: 'translateY(0px)', opacity: disabled ? 0.4 : 1 }}
      _hover={{ outlineColor: disabled ? undefined : 'gray.emphasized' }}
      _active={{ bg: disabled ? undefined : 'gray.subtle' }}
      {...props}
    >
      <button type="button" disabled={disabled}>
        {children}
      </button>
    </Box>
  </Tooltip>
);

interface FunnelStepFormProps {
  index: number;
  isLastStep: boolean;
  step: FunnelStep;
  moveStep: (direction: 'up' | 'down') => void;
  updateStep: (updates: Partial<FunnelStep>) => void;
  removeStep?: () => void;
  disabled?: boolean;
}

export const FunnelStepForm = ({
  index,
  isLastStep,
  step,
  moveStep,
  updateStep,
  removeStep,
  disabled,
}: FunnelStepFormProps) => {
  const [editStepName, setEditStepName] = useState<string | null>(null);
  const isFirstStep = index === 0;

  const updateStepName = () => {
    if (editStepName !== null) {
      updateStep({ name: editStepName });
      setEditStepName(null);
    }
  };

  return (
    <Card.Root size="sm" variant="outline">
      <Card.Header borderBottom="1px solid" borderColor="border.emphasized/50" pl="0" py={2.5} className="group">
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={0.5} w="100%" maxW="100%">
            <Flex pos="relative" w="38px" h="32px">
              <Icon
                as={TbGripVertical}
                pos="absolute"
                top="8.5px"
                left="14px"
                color="fg.muted"
                transition="all 0.2s ease-in-out"
                _groupHover={{ transform: 'translateY(-5px)', opacity: 0 }}
              />
              <MoveIconButton
                tooltipContent="Move step up"
                disabled={isFirstStep}
                top="0px"
                onClick={() => moveStep('up')}
              >
                <TbChevronUp />
              </MoveIconButton>
              <MoveIconButton
                tooltipContent="Move step down"
                disabled={isLastStep}
                bottom="1px"
                onClick={() => moveStep('down')}
              >
                <TbChevronDown />
              </MoveIconButton>
            </Flex>
            {editStepName !== null ? (
              <Input
                className="funnel-step-name"
                autoFocus
                w="auto"
                flexGrow={1}
                size="2xs"
                placeholder={`Step ${index + 1}`}
                value={editStepName}
                onChange={(e) => setEditStepName(e.target.value)}
                onBlur={updateStepName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    updateStepName();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditStepName(null);
                  }
                }}
              />
            ) : (
              <>
                <Text fontSize="sm" fontWeight="medium" my={1} truncate>
                  {step.name || `Step ${index + 1}`}
                </Text>
                <IconButton
                  size="2xs"
                  variant="ghost"
                  colorPalette="gray"
                  onClick={() => setEditStepName(step.name || '')}
                >
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
