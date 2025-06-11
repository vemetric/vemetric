import type { IFilterConfig, IPageFilter } from '@vemetric/common/filters';
import { buildStringFilterQuery } from './base-filters';

export const buildPageFilterQuery = (filter: IPageFilter) => {
  if (
    (filter.pathFilter === undefined || filter.pathFilter.operator === 'any') &&
    (filter.originFilter === undefined || filter.originFilter.operator === 'any')
  ) {
    return '';
  }

  const pathQuery = buildStringFilterQuery('pathname', filter.pathFilter);
  const originQuery = buildStringFilterQuery('origin', filter.originFilter);

  const query = [pathQuery, originQuery]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildPageFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const pageFilters = filterConfig.filters.filter((filter) => filter.type === 'page');

  const positiveFilters = pageFilters.filter((filter) => !filter.pathFilter?.operator.includes('not'));
  const negativeFilters = pageFilters.filter((filter) => filter.pathFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildPageFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildPageFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
