import type { IFilterConfig, IUserFilter } from '@vemetric/common/filters';

export const buildUserFilterQuery = (filter: IUserFilter) => {
  return filter.anonymous
    ? `(userIdentifier IS NULL OR userIdentifier = '')`
    : `(userIdentifier IS NOT NULL AND userIdentifier != '')`;
};

export const buildUserFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const userFilters = filterConfig.filters.filter((filter) => filter.type === 'user');

  const positiveQueries = userFilters
    .map((filter) => buildUserFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  return [positiveQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
