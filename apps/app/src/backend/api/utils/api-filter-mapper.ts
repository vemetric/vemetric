import type {
  IEventFilter,
  IFilter,
  IFilterConfig,
  IFilterGroup,
  IStringFilterOperator,
} from '@vemetric/common/filters';
import type { ApiFilter, ApiStringOperator } from '../schemas/api-filters';

function mapApiStringOperator(operator: ApiStringOperator): IStringFilterOperator {
  if (operator === 'eq') {
    return 'is';
  }

  if (operator === 'notEq') {
    return 'isNot';
  }

  return operator;
}

function mapApiStringFilter(
  filter:
    | {
        value: string;
        operator: ApiStringOperator;
      }
    | undefined,
): { value: string; operator: IStringFilterOperator } | undefined {
  if (!filter) {
    return undefined;
  }

  return {
    value: filter.value,
    operator: mapApiStringOperator(filter.operator),
  };
}

export function mapApiEventFilter(filter: Extract<ApiFilter, { type: 'event' }>): IEventFilter {
  return {
    type: 'event',
    nameFilter: mapApiStringFilter(filter.name),
    propertiesFilter: filter.properties?.map((property) => ({
      property: property.property,
      valueFilter: {
        operator: mapApiStringOperator(property.operator),
        value: property.value,
      },
    })),
  };
}

function mapApiFilter(filter: ApiFilter): IFilter {
  switch (filter.type) {
    case 'page': {
      return {
        type: 'page',
        originFilter: mapApiStringFilter(filter.origin),
        pathFilter: mapApiStringFilter(filter.path),
        hashFilter: mapApiStringFilter(filter.hash),
      };
    }
    case 'event': {
      return mapApiEventFilter(filter);
    }
    case 'user': {
      return {
        type: 'user',
        anonymous: filter.anonymous,
      };
    }
    case 'location': {
      return {
        type: 'location',
        countryFilter: filter.country,
        cityFilter: filter.city,
      };
    }
    case 'referrer': {
      return {
        type: 'referrer',
        referrerFilter: mapApiStringFilter(filter),
      };
    }
    case 'referrer_url': {
      return {
        type: 'referrerUrl',
        referrerUrlFilter: mapApiStringFilter(filter),
      };
    }
    case 'referrer_type': {
      return {
        type: 'referrerType',
        referrerTypeFilter: filter,
      };
    }
    case 'utm_tags': {
      return {
        type: 'utmTags',
        utmCampaignFilter: mapApiStringFilter(filter.utm_campaign),
        utmContentFilter: mapApiStringFilter(filter.utm_content),
        utmMediumFilter: mapApiStringFilter(filter.utm_medium),
        utmSourceFilter: mapApiStringFilter(filter.utm_source),
        utmTermFilter: mapApiStringFilter(filter.utm_term),
      };
    }
    case 'browser': {
      return {
        type: 'browser',
        browserFilter: filter,
      };
    }
    case 'device': {
      return {
        type: 'device',
        deviceFilter: filter,
      };
    }
    case 'os': {
      return {
        type: 'os',
        osFilter: filter,
      };
    }
  }
}

export function mapApiFilterConfig(
  filters: ApiFilter[] | undefined,
  operator: 'and' | 'or',
): IFilterConfig | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }

  const mappedFilters = filters.map(mapApiFilter);
  const internal: IFilterConfig = {
    operator,
    filters: mappedFilters as Array<IFilter | IFilterGroup>,
  };
  return internal;
}
