import type { FunnelStep } from '@vemetric/common/funnel';
import { mapInternalEventFilter, mapInternalPageFilter } from './internal-to-api-filter-mapper';

export function mapFunnelStepToApi(step: FunnelStep, index: number) {
  const name = step.name.trim() === '' ? `Step ${index + 1}` : step.name;

  if (step.filter.type === 'page') {
    return {
      id: step.id,
      name,
      filter: mapInternalPageFilter(step.filter),
    };
  }

  return {
    id: step.id,
    name,
    filter: mapInternalEventFilter(step.filter),
  };
}
