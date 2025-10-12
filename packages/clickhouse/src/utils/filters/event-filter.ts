import type { IEventFilter, IFilterConfig } from '@vemetric/common/filters';
import { escape } from 'sqlstring';
import { buildStringFilterQuery } from './base-filters';
import { buildBrowserFilterQuery } from './browser-filter';
import { buildDeviceFilterQuery } from './device-filter';
import { buildOsFilterQuery } from './os-filter';
import { buildPageFilterQuery } from './page-filter';

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
  const pageFilters = filterConfig.filters.filter((filter) => filter.type === 'page');
  const browserFilters = filterConfig.filters.filter((filter) => filter.type === 'browser');
  const deviceFilters = filterConfig.filters.filter((filter) => filter.type === 'device');
  const osFilters = filterConfig.filters.filter((filter) => filter.type === 'os');

  const positiveEventFilters = eventFilters.filter((filter) => !filter.nameFilter?.operator.includes('not'));
  const negativeEventFilters = eventFilters.filter((filter) => filter.nameFilter?.operator.includes('not'));

  const positivePageFilters = pageFilters.filter(
    (filter) =>
      !filter.pathFilter?.operator.includes('not') &&
      !filter.originFilter?.operator.includes('not') &&
      !filter.hashFilter?.operator.includes('not'),
  );
  const negativePageFilters = pageFilters.filter(
    (filter) =>
      filter.pathFilter?.operator.includes('not') ||
      filter.originFilter?.operator.includes('not') ||
      filter.hashFilter?.operator.includes('not'),
  );

  const positiveBrowserFilters = browserFilters.filter((filter) => !filter.browserFilter?.operator.includes('not'));
  const negativeBrowserFilters = browserFilters.filter((filter) => filter.browserFilter?.operator.includes('not'));

  const positiveDeviceFilters = deviceFilters.filter((filter) => !filter.deviceFilter?.operator.includes('not'));
  const negativeDeviceFilters = deviceFilters.filter((filter) => filter.deviceFilter?.operator.includes('not'));

  const positiveOsFilters = osFilters.filter((filter) => !filter.osFilter?.operator.includes('not'));
  const negativeOsFilters = osFilters.filter((filter) => filter.osFilter?.operator.includes('not'));

  const positiveEventQueries = positiveEventFilters
    .map((filter) => buildEventFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeEventQueries = negativeEventFilters
    .map((filter) => buildEventFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  const positivePageQueries = positivePageFilters
    .map((filter) => buildPageFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativePageQueries = negativePageFilters
    .map((filter) => buildPageFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  const positiveBrowserQueries = positiveBrowserFilters
    .map((filter) => buildBrowserFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeBrowserQueries = negativeBrowserFilters
    .map((filter) => buildBrowserFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  const positiveDeviceQueries = positiveDeviceFilters
    .map((filter) => buildDeviceFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeDeviceQueries = negativeDeviceFilters
    .map((filter) => buildDeviceFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  const positiveOsQueries = positiveOsFilters
    .map((filter) => buildOsFilterQuery(filter))
    .filter(Boolean)
    .join(` OR `);

  const negativeOsQueries = negativeOsFilters
    .map((filter) => buildOsFilterQuery(filter))
    .filter(Boolean)
    .join(` AND `);

  const positiveQueries = [
    positiveEventQueries,
    positivePageQueries,
    positiveBrowserQueries,
    positiveDeviceQueries,
    positiveOsQueries,
  ]
    .filter(Boolean)
    .join(` OR `);

  const negativeQueries = [
    negativeEventQueries,
    negativePageQueries,
    negativeBrowserQueries,
    negativeDeviceQueries,
    negativeOsQueries,
  ]
    .filter(Boolean)
    .join(` AND `);

  return [positiveQueries, negativeQueries].filter(Boolean).join(` ${filterConfig.operator} `);
};
