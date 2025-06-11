import type { IFilterConfig, IDeviceFilter } from '@vemetric/common/filters';
import { buildListFilterQuery } from './base-filters';

export const buildDeviceFilterQuery = (filter: IDeviceFilter) => {
  if (filter.deviceFilter === undefined || filter.deviceFilter.operator === 'any') {
    return '';
  }

  const deviceQuery = buildListFilterQuery('deviceType', filter.deviceFilter);

  const query = [deviceQuery]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildDeviceFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const deviceFilters = filterConfig.filters.filter((filter) => filter.type === 'device');

  const positiveFilters = deviceFilters.filter((filter) => !filter.deviceFilter?.operator.includes('not'));
  const negativeFilters = deviceFilters.filter((filter) => filter.deviceFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildDeviceFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildDeviceFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
