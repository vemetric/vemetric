import type { IEventFilter, IFilterConfig } from '@vemetric/common/filters';
import sqlstring from 'sqlstring';

const { escape } = sqlstring;
import { buildStringFilterQuery } from './base-filters';

export const buildEventFilterQuery = (filter: IEventFilter) => {
  if (filter.nameFilter === undefined || filter.nameFilter.operator === 'any') {
    return '';
  }

  const nameQuery = buildStringFilterQuery('name', filter.nameFilter);

  const propertyQueries =
    filter.propertiesFilter
      ?.map((propertyFilter) =>
        buildStringFilterQuery(
          `JSONExtractString(customData, ${escape(propertyFilter.property)})`,
          propertyFilter.valueFilter,
        ),
      )
      .filter(Boolean)
      .join(' AND ') ?? '';

  const query = [nameQuery, propertyQueries]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' AND ');

  return query ? `(${query})` : '';
};

export const buildEventFilterQueries = (filterConfig: IFilterConfig) => {
  if (!filterConfig) {
    return '';
  }

  const eventFilters = filterConfig.filters.filter((filter) => filter.type === 'event');

  const positiveFilters = eventFilters.filter((filter) => !filter.nameFilter?.operator.includes('not'));
  const negativeFilters = eventFilters.filter((filter) => filter.nameFilter?.operator.includes('not'));

  const positiveQueries = positiveFilters
    .map((filter) => buildEventFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = negativeFilters
    .map((filter) => buildEventFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
