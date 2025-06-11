import type { IFilterConfig, ILocationFilter } from '@vemetric/common/filters';
import { buildListFilterQuery } from './base-filters';

export const buildLocationFilterQuery = (filter: ILocationFilter) => {
  if (filter.countryFilter === undefined || filter.countryFilter.operator === 'any') {
    return '';
  }

  const countryQuery = buildListFilterQuery('countryCode', filter.countryFilter);

  const query = [countryQuery]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildLocationFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const locationFilters = filterConfig.filters.filter((filter) => filter.type === 'location');

  const positiveFilters = locationFilters.filter((filter) => !filter.countryFilter?.operator.includes('not'));
  const negativeFilters = locationFilters.filter((filter) => filter.countryFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildLocationFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildLocationFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
