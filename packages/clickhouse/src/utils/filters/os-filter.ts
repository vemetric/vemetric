import type { IFilterConfig, IOsFilter } from '@vemetric/common/filters';
import { buildListFilterQuery } from './base-filters';

export const buildOsFilterQuery = (filter: IOsFilter) => {
  if (filter.osFilter === undefined || filter.osFilter.operator === 'any') {
    return '';
  }

  const osQuery = buildListFilterQuery('osName', filter.osFilter);

  const query = [osQuery]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildOsFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const osFilters = filterConfig.filters.filter((filter) => filter.type === 'os');

  const positiveFilters = osFilters.filter((filter) => !filter.osFilter?.operator.includes('not'));
  const negativeFilters = osFilters.filter((filter) => filter.osFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildOsFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildOsFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
