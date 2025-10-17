import { formatClickhouseDate } from '@vemetric/common/date';
import type { IFilterConfig } from '@vemetric/common/filters';
import type { FunnelStep } from '@vemetric/common/funnel';
import { escape } from 'sqlstring';
import { buildBrowserFilterQuery } from './browser-filter';
import { buildDeviceFilterQuery } from './device-filter';
import { buildEventFilterQuery } from './event-filter';
import { buildFunnelFilterQuery } from './funnel-filter';
import { buildLocationFilterQuery } from './location-filter';
import { buildOsFilterQuery } from './os-filter';
import { buildPageFilterQuery } from './page-filter';
import { buildReferrerFilterQuery, buildReferrerTypeFilterQuery, buildReferrerUrlFilterQuery } from './referrer-filter';
import { buildUserFilterQuery } from './user-filter';
import { buildUtmTagsFilterQuery } from './utm-tags-filter';

export const getUserFilterQueries = (props: {
  filterConfig: IFilterConfig;
  projectId: bigint;
  startDate?: Date;
  endDate?: Date;
  funnelsData?: Map<string, FunnelStep[]>;
}) => {
  const { filterConfig, projectId, startDate, endDate, funnelsData } = props;

  if (!filterConfig) {
    return {
      filterQueries: '',
    };
  }

  const userIdQueries: string[] = [];

  filterConfig.filters.forEach((filter) => {
    switch (filter.type) {
      case 'page': {
        const filterQuery = buildPageFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
            (SELECT DISTINCT userId
              FROM event
              WHERE projectId=${escape(projectId)}
                AND isPageView=1
                AND ${filterQuery}
                ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
                ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
              GROUP BY userId
              HAVING count() >= 1)`);
        break;
      }
      case 'event': {
        const filterQuery = buildEventFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
          (SELECT DISTINCT userId
            FROM event
            WHERE projectId=${escape(projectId)}
              AND isPageView <> 1
              AND ${filterQuery}
              ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
              ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
            GROUP BY userId
            HAVING count() >= 1)`);
        break;
      }
      case 'user': {
        const filterQuery = buildUserFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
          (SELECT DISTINCT userId
            FROM event
            WHERE projectId=${escape(projectId)}
              AND ${filterQuery}
              ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
              ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
            GROUP BY userId
            HAVING count() >= 1)`);
        break;
      }
      case 'location': {
        const filterQuery = buildLocationFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
            (SELECT DISTINCT userId
              FROM session
              WHERE projectId=${escape(projectId)}
                AND ${filterQuery}
                ${startDate ? `AND startedAt >= '${formatClickhouseDate(startDate)}'` : ''}
                ${endDate ? `AND startedAt < '${formatClickhouseDate(endDate)}'` : ''}
                AND deleted = 0
              GROUP BY userId
              HAVING count() >= 1)`);
        break;
      }
      case 'browser': {
        const filterQuery = buildBrowserFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
          (SELECT DISTINCT userId
            FROM event
            WHERE projectId=${escape(projectId)}
              AND ${filterQuery}
              ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
              ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
            GROUP BY userId
            HAVING count() >= 1)`);
        break;
      }
      case 'device': {
        const filterQuery = buildDeviceFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
          (SELECT DISTINCT userId
            FROM event
            WHERE projectId=${escape(projectId)}
              AND ${filterQuery}
              ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
              ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
            GROUP BY userId
            HAVING count() >= 1)`);
        break;
      }
      case 'os': {
        const filterQuery = buildOsFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
          (SELECT DISTINCT userId
            FROM event
            WHERE projectId=${escape(projectId)}
              AND ${filterQuery}
              ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
              ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
            GROUP BY userId
            HAVING count() >= 1)`);
        break;
      }
      case 'referrer': {
        const filterQuery = buildReferrerFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
            (SELECT DISTINCT userId
              FROM session
              WHERE projectId=${escape(projectId)}
                AND ${filterQuery}
                ${startDate ? `AND startedAt >= '${formatClickhouseDate(startDate)}'` : ''}
                ${endDate ? `AND startedAt < '${formatClickhouseDate(endDate)}'` : ''}
                AND deleted = 0
              GROUP BY userId
              HAVING count() >= 1)`);
        break;
      }
      case 'referrerUrl': {
        const filterQuery = buildReferrerUrlFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
            (SELECT DISTINCT userId
              FROM session
              WHERE projectId=${escape(projectId)}
                AND ${filterQuery}
                ${startDate ? `AND startedAt >= '${formatClickhouseDate(startDate)}'` : ''}
                ${endDate ? `AND startedAt < '${formatClickhouseDate(endDate)}'` : ''}
                AND deleted = 0
              GROUP BY userId
              HAVING count() >= 1)`);
        break;
      }
      case 'referrerType': {
        const filterQuery = buildReferrerTypeFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
            (SELECT DISTINCT userId
              FROM session
              WHERE projectId=${escape(projectId)}
                AND ${filterQuery}
                ${startDate ? `AND startedAt >= '${formatClickhouseDate(startDate)}'` : ''}
                ${endDate ? `AND startedAt < '${formatClickhouseDate(endDate)}'` : ''}
                AND deleted = 0
              GROUP BY userId
              HAVING count() >= 1)`);
        break;
      }
      case 'utmTags': {
        const filterQuery = buildUtmTagsFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
            (SELECT DISTINCT userId
              FROM session
              WHERE projectId=${escape(projectId)}
                AND ${filterQuery}
                ${startDate ? `AND startedAt >= '${formatClickhouseDate(startDate)}'` : ''}
                ${endDate ? `AND startedAt < '${formatClickhouseDate(endDate)}'` : ''}
                AND deleted = 0
              GROUP BY userId
              HAVING count() >= 1)`);
        break;
      }
      case 'funnel': {
        if (!funnelsData) {
          return;
        }

        const funnelSteps = funnelsData.get(filter.id);
        if (!funnelSteps || !funnelSteps[filter.step]) {
          return;
        }

        const filterQuery = buildFunnelFilterQuery(filter, projectId, funnelSteps, startDate, endDate);
        if (!filterQuery) {
          return;
        }

        userIdQueries.push(`
          (SELECT DISTINCT userId
            FROM event
            WHERE projectId=${escape(projectId)}
              AND ${filterQuery}
              ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
              ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
            GROUP BY userId)`);
        break;
      }
    }
  });

  let userFilterQueries = '';
  if (userIdQueries.length > 0) {
    if (filterConfig.operator === 'and') {
      userFilterQueries = `(userId IN (${userIdQueries.join(' INTERSECT ')}))`;
    } else {
      userFilterQueries = `(userId IN (${userIdQueries.join(' UNION DISTINCT ')}))`;
    }
  }

  return {
    filterQueries: userFilterQueries.trim() ? `AND (${userFilterQueries})` : '',
  };
};

export const getEventFilterQueries = (props: { filterConfig: IFilterConfig }) => {
  const { filterConfig } = props;

  if (!filterConfig) {
    return {
      filterQueries: '',
    };
  }

  const eventFilterQueries: string[] = [];

  filterConfig.filters.forEach((filter) => {
    switch (filter.type) {
      case 'event': {
        const filterQuery = buildEventFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'page': {
        const filterQuery = buildPageFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'user': {
        const filterQuery = buildUserFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'location': {
        const filterQuery = buildLocationFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'browser': {
        const filterQuery = buildBrowserFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'device': {
        const filterQuery = buildDeviceFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'os': {
        const filterQuery = buildOsFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'referrer': {
        const filterQuery = buildReferrerFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'referrerUrl': {
        const filterQuery = buildReferrerUrlFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'referrerType': {
        const filterQuery = buildReferrerTypeFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
      case 'utmTags': {
        const filterQuery = buildUtmTagsFilterQuery(filter);
        if (!filterQuery) {
          return;
        }

        eventFilterQueries.push(filterQuery);
        break;
      }
    }
  });

  return {
    filterQueries:
      eventFilterQueries.length > 0
        ? '(' + eventFilterQueries.join(` ${filterConfig.operator === 'and' ? 'AND' : 'OR'} `) + ')'
        : '',
  };
};
