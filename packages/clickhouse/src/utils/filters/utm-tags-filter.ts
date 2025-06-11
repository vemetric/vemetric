import type { IFilterConfig, IUtmTagsFilter } from '@vemetric/common/filters';
import { buildStringFilterQuery } from './base-filters';

export const buildUtmTagsFilterQuery = (filter: IUtmTagsFilter) => {
  if (
    (filter.utmCampaignFilter === undefined || filter.utmCampaignFilter.operator === 'any') &&
    (filter.utmContentFilter === undefined || filter.utmContentFilter.operator === 'any') &&
    (filter.utmMediumFilter === undefined || filter.utmMediumFilter.operator === 'any') &&
    (filter.utmSourceFilter === undefined || filter.utmSourceFilter.operator === 'any') &&
    (filter.utmTermFilter === undefined || filter.utmTermFilter.operator === 'any')
  ) {
    return '';
  }

  const utmCampaignQuery = buildStringFilterQuery('utmCampaign', filter.utmCampaignFilter);
  const utmContentQuery = buildStringFilterQuery('utmContent', filter.utmContentFilter);
  const utmMediumQuery = buildStringFilterQuery('utmMedium', filter.utmMediumFilter);
  const utmSourceQuery = buildStringFilterQuery('utmSource', filter.utmSourceFilter);
  const utmTermQuery = buildStringFilterQuery('utmTerm', filter.utmTermFilter);

  const query = [utmCampaignQuery, utmContentQuery, utmMediumQuery, utmSourceQuery, utmTermQuery]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildUtmCampaignFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const utmCampaignFilters = filterConfig.filters
    .filter((filter) => filter.type === 'utmTags')
    .filter((filter) => filter.utmCampaignFilter !== undefined && filter.utmCampaignFilter.operator !== 'any');

  const positiveFilters = utmCampaignFilters.filter((filter) => !filter.utmCampaignFilter?.operator.includes('not'));
  const negativeFilters = utmCampaignFilters.filter((filter) => filter.utmCampaignFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildStringFilterQuery('utmCampaign', filter.utmCampaignFilter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildStringFilterQuery('utmCampaign', filter.utmCampaignFilter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};

export const buildUtmContentFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const utmContentFilters = filterConfig.filters
    .filter((filter) => filter.type === 'utmTags')
    .filter((filter) => filter.utmContentFilter !== undefined && filter.utmContentFilter.operator !== 'any');

  const positiveFilters = utmContentFilters.filter((filter) => !filter.utmContentFilter?.operator.includes('not'));
  const negativeFilters = utmContentFilters.filter((filter) => filter.utmContentFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildStringFilterQuery('utmContent', filter.utmContentFilter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildStringFilterQuery('utmContent', filter.utmContentFilter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};

export const buildUtmMediumFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const utmMediumFilters = filterConfig.filters
    .filter((filter) => filter.type === 'utmTags')
    .filter((filter) => filter.utmMediumFilter !== undefined && filter.utmMediumFilter.operator !== 'any');

  const positiveFilters = utmMediumFilters.filter((filter) => !filter.utmMediumFilter?.operator.includes('not'));
  const negativeFilters = utmMediumFilters.filter((filter) => filter.utmMediumFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildStringFilterQuery('utmMedium', filter.utmMediumFilter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildStringFilterQuery('utmMedium', filter.utmMediumFilter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};

export const buildUtmSourceFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const utmSourceFilters = filterConfig.filters
    .filter((filter) => filter.type === 'utmTags')
    .filter((filter) => filter.utmSourceFilter !== undefined && filter.utmSourceFilter.operator !== 'any');

  const positiveFilters = utmSourceFilters.filter((filter) => !filter.utmSourceFilter?.operator.includes('not'));
  const negativeFilters = utmSourceFilters.filter((filter) => filter.utmSourceFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildStringFilterQuery('utmSource', filter.utmSourceFilter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildStringFilterQuery('utmSource', filter.utmSourceFilter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};

export const buildUtmTermFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const utmTermFilters = filterConfig.filters
    .filter((filter) => filter.type === 'utmTags')
    .filter((filter) => filter.utmTermFilter !== undefined && filter.utmTermFilter.operator !== 'any');

  const positiveFilters = utmTermFilters.filter((filter) => !filter.utmTermFilter?.operator.includes('not'));
  const negativeFilters = utmTermFilters.filter((filter) => filter.utmTermFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildStringFilterQuery('utmTerm', filter.utmTermFilter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildStringFilterQuery('utmTerm', filter.utmTermFilter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
