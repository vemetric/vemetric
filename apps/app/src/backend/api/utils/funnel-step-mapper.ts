import type { FunnelStep } from '@vemetric/common/funnel';
import { mapInternalEventFilter, mapInternalPageFilter } from './internal-to-api-filter-mapper';

export function mapFunnelStepToApi(step: FunnelStep) {
  if (step.filter.type === 'page') {
    return {
      id: step.id,
      name: step.name,
      filter: mapInternalPageFilter(step.filter),
    };
  }

  return {
    id: step.id,
    name: step.name,
    filter: mapInternalEventFilter(step.filter),
  };
}
