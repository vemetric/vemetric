import { Flex, Span, Text } from '@chakra-ui/react';
import type { IFilter, IFunnelFilter } from '@vemetric/common/filters';
import { useFilterContext } from './filter-context';
import type { TooltipProps } from '../ui/tooltip';
import { Tooltip } from '../ui/tooltip';

const FunnelFilterTooltipContent = ({ filter }: { filter: IFunnelFilter }) => {
  const { funnels } = useFilterContext();
  const funnel = funnels.find(({ id }) => id === filter.id);
  if (!funnel) {
    return null;
  }

  const step = funnel.steps[filter.step];
  const isLastStep = filter.step === funnel.steps.length - 1;
  const hasStepName = step.name && step.name.length > 0;

  const stepText = isLastStep ? null : (
    <Span>
      {hasStepName ? (
        <>
          the Step <Span fontWeight="bold">&quot;{step.name}&quot;</Span>
        </>
      ) : (
        <Span fontWeight="bold">Step {filter.step + 1}</Span>
      )}{' '}
      of{' '}
    </Span>
  );

  return (
    <Text>
      Filters for all users that have {filter.operator === 'notCompleted' && 'not'} completed {stepText}the Funnel{' '}
      <Span fontWeight="bold">&quot;{funnel.name}&quot;</Span>
    </Text>
  );
};

const FilterTooltipContent = ({ filter }: { filter: IFilter }) => {
  if (filter.type === 'funnel') {
    return <FunnelFilterTooltipContent filter={filter} />;
  }

  const entries = Object.entries(filter)
    .map(([key, value]) => {
      if (typeof value !== 'object') {
        return null;
      }

      if (Array.isArray(value)) {
        // TODO: here we would need to e.g. handle the toolip visualization for the event properties filter
        return null;
      }

      let name = key.replace('Filter', '');
      if (key === 'osFilter') {
        name = 'Operating System';
      }

      return (
        <Flex key={key} gap={1.5}>
          <Text textTransform="capitalize">{name}</Text>
          <Text>{value.operator}</Text>
          <Text>
            {value.operator === 'any' ? '' : Array.isArray(value.value) ? value.value.join(', ') : value.value}
          </Text>
        </Flex>
      );
    })
    .filter(Boolean);

  return (
    <Flex flexDir="column" gap={2}>
      {entries}
    </Flex>
  );
};

interface Props extends Omit<TooltipProps, 'content'> {
  filter: IFilter;
}

export const FilterTooltip = ({ filter, ...props }: Props) => {
  return <Tooltip {...props} content={<FilterTooltipContent filter={filter} />} />;
};
