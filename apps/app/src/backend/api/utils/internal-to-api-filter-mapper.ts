import type { IEventFilter, IPageFilter, IStringFilterOperator } from '@vemetric/common/filters';
import type { ApiFilter, ApiStringOperator } from '../schemas/api-filters';

export function mapInternalStringOperator(operator: IStringFilterOperator): ApiStringOperator {
  if (operator === 'is') {
    return 'eq';
  }

  if (operator === 'isNot') {
    return 'notEq';
  }

  return operator;
}

export function mapInternalPageFilter(filter: IPageFilter): Extract<ApiFilter, { type: 'page' }> {
  return {
    type: 'page',
    origin: filter.originFilter
      ? {
          operator: mapInternalStringOperator(filter.originFilter.operator),
          value: filter.originFilter.value,
        }
      : undefined,
    path: filter.pathFilter
      ? {
          operator: mapInternalStringOperator(filter.pathFilter.operator),
          value: filter.pathFilter.value,
        }
      : undefined,
    hash: filter.hashFilter
      ? {
          operator: mapInternalStringOperator(filter.hashFilter.operator),
          value: filter.hashFilter.value,
        }
      : undefined,
  };
}

export function mapInternalEventFilter(filter: IEventFilter): Extract<ApiFilter, { type: 'event' }> {
  return {
    type: 'event',
    name: filter.nameFilter
      ? {
          operator: mapInternalStringOperator(filter.nameFilter.operator),
          value: filter.nameFilter.value,
        }
      : undefined,
    properties: filter.propertiesFilter?.map((propertyFilter) => ({
      property: propertyFilter.property,
      operator: mapInternalStringOperator(propertyFilter.valueFilter.operator),
      value: propertyFilter.valueFilter.value,
    })),
  };
}
