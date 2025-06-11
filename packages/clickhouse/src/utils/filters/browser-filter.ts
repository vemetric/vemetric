import type { IFilterConfig, IBrowserFilter } from '@vemetric/common/filters';
import { buildListFilterQuery } from './base-filters';

export const buildBrowserFilterQuery = (filter: IBrowserFilter) => {
  if (filter.browserFilter === undefined || filter.browserFilter.operator === 'any') {
    return '';
  }

  const browserQuery = buildListFilterQuery('clientName', filter.browserFilter);

  const query = [browserQuery]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildBrowserFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const browserFilters = filterConfig.filters.filter((filter) => filter.type === 'browser');

  const positiveFilters = browserFilters.filter((filter) => !filter.browserFilter?.operator.includes('not'));
  const negativeFilters = browserFilters.filter((filter) => filter.browserFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildBrowserFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildBrowserFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
