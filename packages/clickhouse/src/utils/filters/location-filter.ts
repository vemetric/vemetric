import type { IFilterConfig, ILocationFilter } from '@vemetric/common/filters';
import { buildListFilterQuery } from './base-filters';

export const buildLocationFilterQuery = (filter: ILocationFilter) => {
  const hasCountryFilter = filter.countryFilter !== undefined && filter.countryFilter.operator !== 'any';
  const hasCityFilter = filter.cityFilter !== undefined && filter.cityFilter.operator !== 'any';

  if (!hasCountryFilter && !hasCityFilter) {
    return '';
  }

  const countryQuery = hasCountryFilter ? buildListFilterQuery('countryCode', filter.countryFilter!) : '';
  const cityQuery = hasCityFilter ? buildListFilterQuery('city', filter.cityFilter!) : '';

  const query = [countryQuery, cityQuery]
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

  const isNegativeFilter = (filter: ILocationFilter) =>
    filter.countryFilter?.operator === 'noneOf' || filter.cityFilter?.operator === 'noneOf';

  const positiveFilters = locationFilters.filter((filter) => !isNegativeFilter(filter));
  const negativeFilters = locationFilters.filter((filter) => isNegativeFilter(filter));

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
