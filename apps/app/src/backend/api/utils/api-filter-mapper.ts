import type { IFilter, IFilterConfig, IFilterGroup } from '@vemetric/common/filters';
import type { ApiFilter } from '../schemas/api-filters';

function mapApiFilter(filter: ApiFilter): IFilter {
  switch (filter.type) {
    case 'page': {
      return {
        type: 'page',
        originFilter: filter.origin,
        pathFilter: filter.path,
        hashFilter: filter.hash,
      };
    }
    case 'event': {
      return {
        type: 'event',
        nameFilter: filter.name,
        propertiesFilter: filter.properties?.map((property) => ({
          property: property.property,
          valueFilter: {
            operator: property.operator,
            value: property.value,
          },
        })),
      };
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
        referrerFilter: filter,
      };
    }
    case 'referrer_url': {
      return {
        type: 'referrerUrl',
        referrerUrlFilter: filter,
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
        utmCampaignFilter: filter.utm_campaign,
        utmContentFilter: filter.utm_content,
        utmMediumFilter: filter.utm_medium,
        utmSourceFilter: filter.utm_source,
        utmTermFilter: filter.utm_term,
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
