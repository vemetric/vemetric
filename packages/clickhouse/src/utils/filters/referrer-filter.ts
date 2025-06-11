import type { IFilterConfig, IReferrerFilter, IReferrerTypeFilter, IReferrerUrlFilter } from '@vemetric/common/filters';
import { buildListFilterQuery, buildStringFilterQuery } from './base-filters';

export const buildReferrerFilterQuery = (filter: IReferrerFilter) => {
  if (filter.referrerFilter === undefined || filter.referrerFilter.operator === 'any') {
    return '';
  }

  const referrerQuery = buildStringFilterQuery('referrer', filter.referrerFilter);

  const query = [referrerQuery]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildReferrerFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const referrerFilters = filterConfig.filters.filter((filter) => filter.type === 'referrer');

  const positiveFilters = referrerFilters.filter((filter) => !filter.referrerFilter?.operator.includes('not'));
  const negativeFilters = referrerFilters.filter((filter) => filter.referrerFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildReferrerFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildReferrerFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};

export const buildReferrerUrlFilterQuery = (filter: IReferrerUrlFilter) => {
  if (filter.referrerUrlFilter === undefined || filter.referrerUrlFilter.operator === 'any') {
    return '';
  }

  const referrerUrlQuery = buildStringFilterQuery('referrerUrl', filter.referrerUrlFilter);

  const query = [referrerUrlQuery]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildReferrerUrlFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const referrerFilters = filterConfig.filters.filter((filter) => filter.type === 'referrerUrl');

  const positiveFilters = referrerFilters.filter((filter) => !filter.referrerUrlFilter?.operator.includes('not'));
  const negativeFilters = referrerFilters.filter((filter) => filter.referrerUrlFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildReferrerUrlFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildReferrerUrlFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};

export const buildReferrerTypeFilterQuery = (filter: IReferrerTypeFilter) => {
  if (filter.referrerTypeFilter === undefined || filter.referrerTypeFilter.operator === 'any') {
    return '';
  }

  const referrerTypeQuery = buildListFilterQuery('referrerType', filter.referrerTypeFilter);

  const query = [referrerTypeQuery]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildReferrerTypeFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const referrerFilters = filterConfig.filters.filter((filter) => filter.type === 'referrerType');

  const positiveFilters = referrerFilters.filter((filter) => !filter.referrerTypeFilter?.operator.includes('not'));
  const negativeFilters = referrerFilters.filter((filter) => filter.referrerTypeFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildReferrerTypeFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildReferrerTypeFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
