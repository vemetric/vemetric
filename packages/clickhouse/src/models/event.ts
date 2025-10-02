import { formatClickhouseDate } from '@vemetric/common/date';
import type { IFilterConfig, stringOperatorsSchema } from '@vemetric/common/filters';
import type { FunnelStep } from '@vemetric/common/funnel';
import { jsonStringify } from '@vemetric/common/json';
import type { IUserSortConfig } from '@vemetric/common/sort';
import { escape } from 'sqlstring';
import type { z } from 'zod';
import { clickhouseClient, clickhouseInsert } from '../client';
import type { DeviceData } from './device';
import { EXAMPLE_DEVICE_DATA } from './device';
import type { FilterOptions, GeoData, ReferrerData, UrlData } from './session';
import { EXAMPLE_URL_DATA } from './session';
import { formatDateExpression } from '../utils/date';
import { getEventFilterQueries } from '../utils/filters';
import { buildStringFilterQuery } from '../utils/filters/base-filters';
import { buildBrowserFilterQueries } from '../utils/filters/browser-filter';
import { buildDeviceFilterQueries } from '../utils/filters/device-filter';
import { buildEventFilterQueries } from '../utils/filters/event-filter';
import { buildOsFilterQueries } from '../utils/filters/os-filter';
import { buildPageFilterQueries } from '../utils/filters/page-filter';
import { buildUserFilterQueries } from '../utils/filters/user-filter';
import { buildFunnelStepConditions, buildWindowFunnelSubquery } from '../utils/funnel';
import { buildUserSortQueries } from '../utils/sort/user-sort';
import { withSpan } from '../utils/with-span';

// we round the current date to the nearest 30 seconds and subtract 4 minutes and 30 seconds
const ONLINE_USERS_INTERVAL_QUERY = 'toStartOfInterval(NOW(), INTERVAL 30 SECOND) - INTERVAL 270 SECOND';

const TABLE_NAME = 'event';

export type ClickhouseEvent = DeviceData &
  GeoData &
  UrlData &
  ReferrerData & {
    projectId: bigint;
    userId: bigint;
    sessionId: string;
    deviceId: bigint;
    contextId: string;
    createdAt: string;

    id: string;
    name: string;

    isPageView: boolean;

    // TODO: remove at a later point because we store headers anyways?, also from user table
    userAgent?: string;

    userIdentifier?: string;
    userDisplayName?: string;

    requestHeaders: Record<string, string>;
    customData: Record<string, any>;

    importSource?: string;
  };

export const EXAMPLE_EVENT: Required<ClickhouseEvent> = {
  ...EXAMPLE_DEVICE_DATA,
  ...EXAMPLE_URL_DATA,
  projectId: BigInt(1),
  userId: BigInt(1),
  sessionId: '',
  deviceId: BigInt(1),
  contextId: '',
  createdAt: '',
  id: '',
  name: '',
  isPageView: true,
  countryCode: '',
  city: '',
  latitude: null,
  longitude: null,
  userAgent: '',
  referrer: '',
  referrerUrl: '',
  referrerType: '',
  userIdentifier: '',
  userDisplayName: '',
  requestHeaders: {},
  customData: {},
  importSource: '',
};

const transformKeySelector = (key: keyof ClickhouseEvent) => (key === 'id' ? key : `any(${key})`);
const EVENT_KEYS = Object.keys(EXAMPLE_EVENT) as Array<keyof ClickhouseEvent>;
const EVENT_KEY_SELECTOR = EVENT_KEYS.map(transformKeySelector).join(',');
const JSON_KEYS = EVENT_KEYS.filter((key) => typeof EXAMPLE_EVENT[key] === 'object');
const BIGINT_KEYS = EVENT_KEYS.filter((key) => typeof EXAMPLE_EVENT[key] === 'bigint');

const mapRowToEvent = (row: any): ClickhouseEvent => {
  const event: ClickhouseEvent = JSON.parse(jsonStringify(EXAMPLE_EVENT));
  EVENT_KEYS.forEach((key) => {
    const keyValue = row[transformKeySelector(key)];
    if (JSON_KEYS.includes(key)) {
      (event as any)[key] = keyValue ? JSON.parse(keyValue) : undefined;
    } else if (BIGINT_KEYS.includes(key)) {
      (event as any)[key] = BigInt(keyValue);
    } else {
      (event as any)[key] = keyValue;
    }
  });

  return event;
};

const EVENT_LIMIT = 50;
const USER_LIMIT = 50;

interface PaginationOptions {
  offset: number;
  limit: number;
}

export const clickhouseEvent = {
  getFilterableData: withSpan('getFilterableData', async (projectId: bigint, startDate: Date, endDate?: Date) => {
    const formattedStartDate = formatClickhouseDate(startDate);

    const resultSet = await clickhouseClient.query({
      query: `
        SELECT 
          (
            SELECT groupArrayDistinct(name)
            FROM event 
            WHERE projectId = ${escape(projectId)} 
              AND createdAt >= '${formattedStartDate}'
              ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
              AND name <> ''
              AND isPageView <> 1
          ) as eventNames,
          (
            SELECT 
              groupArrayDistinct(pathname),
              groupArrayDistinct(origin),
              groupArrayDistinct(clientName),
              groupArrayDistinct(deviceType),
              groupArrayDistinct(osName)
            FROM event 
            WHERE projectId = ${escape(projectId)} 
              AND createdAt >= '${formattedStartDate}'
              AND isPageView = 1
          ) as pages,
          (
            SELECT 
              groupArrayDistinct(referrer),
              groupArrayDistinct(referrerUrl),
              groupArrayDistinct(utmCampaign),
              groupArrayDistinct(utmContent),
              groupArrayDistinct(utmMedium),
              groupArrayDistinct(utmSource),
              groupArrayDistinct(utmTerm),
              groupArrayDistinct(countryCode)
            FROM session 
            WHERE projectId = ${escape(projectId)} 
              AND startedAt >= '${formattedStartDate}'
              AND deleted = 0
          ) as sources
      `,
      format: 'JSONEachRow',
    });

    const result = await resultSet.json<{
      eventNames: string[];
      pages: [string[], string[], string[], string[], string[]];
      sources: [string[], string[], string[], string[], string[], string[], string[], string[]];
    }>();

    // Return the first (and only) row of results
    return {
      ...(result[0] ?? {
        eventNames: [],
        pages: [],
        sources: [],
      }),
    };
  }),
  getFirstPageViewByUserId: async (projectId: bigint, userId: bigint): Promise<ClickhouseEvent | null> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${EVENT_KEY_SELECTOR} FROM ${TABLE_NAME} WHERE projectId=${escape(projectId)} AND userId=${escape(
        userId,
      )} AND isPageView = 1 GROUP BY id HAVING sum(sign) > 0 ORDER BY ${transformKeySelector('createdAt')} ASC LIMIT 1`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return mapRowToEvent(row);
  },
  getFirstEvent: async (projectId: bigint): Promise<Pick<ClickhouseEvent, 'createdAt'> | null> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${transformKeySelector('createdAt')} FROM ${TABLE_NAME} WHERE projectId=${escape(
        projectId,
      )} GROUP BY id HAVING sum(sign) > 0 ORDER BY ${transformKeySelector('createdAt')} ASC LIMIT 1`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      createdAt: row[transformKeySelector('createdAt')],
    };
  },
  findByUserId: async (projectId: bigint, userId: bigint): Promise<Array<ClickhouseEvent>> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${EVENT_KEY_SELECTOR} FROM ${TABLE_NAME} WHERE projectId=${escape(projectId)} AND userId=${escape(
        userId,
      )} GROUP BY id HAVING sum(sign) > 0`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => {
      return mapRowToEvent(row);
    });
  },
  getLatestEventsByUserId: async (props: {
    projectId: bigint;
    userId: bigint;
    limit?: number;
    cursor?: string;
    startDate?: Date;
    date?: string; // YYYY-MM-DD format
  }): Promise<Array<ClickhouseEvent & { isOnline: boolean }>> => {
    const { projectId, userId, limit = EVENT_LIMIT, cursor, startDate, date } = props;

    const cursorClause = cursor ? ` AND createdAt < ${escape(cursor)}` : '';
    const dateClause = date ? ` AND toDate(createdAt) = '${date}'` : '';

    const resultSet = await clickhouseClient.query({
      query: `
        SELECT ${EVENT_KEY_SELECTOR}, 
               max(createdAt) >= ${ONLINE_USERS_INTERVAL_QUERY} as isOnline,
               max(createdAt) as eventTime
        FROM ${TABLE_NAME} 
        WHERE projectId = ${escape(projectId)} 
        AND userId = ${escape(userId)}${cursorClause}${dateClause}
        ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
        GROUP BY id 
        HAVING sum(sign) > 0 
        ORDER BY eventTime DESC 
        LIMIT ${escape(limit)}`,
      format: 'JSONEachRow',
    });

    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => {
      return {
        ...mapRowToEvent(row),
        isOnline: Boolean(row['isOnline']),
      };
    });
  },
  getLatestUsers: withSpan(
    'getLatestUsers',
    async (
      projectId: bigint,
      pagination: PaginationOptions = { offset: 0, limit: USER_LIMIT },
      filterQueries: string,
      filterConfig: IFilterConfig,
      sortConfig: IUserSortConfig,
      startDate?: Date,
    ) => {
      const userFilterQueries = filterConfig?.operator === 'and' ? buildUserFilterQueries(filterConfig) : '';
      const { joinClause, orderByClause, sortSelect, isSortByEvent } = buildUserSortQueries(sortConfig, projectId);

      const resultSet = await clickhouseClient.query({
        query: `SELECT u.userId, u.identifier, u.displayName, u.countryCode, u.maxCreatedAt, u.isOnline${sortSelect}
              FROM (
                SELECT userId, 
                  argMax(userIdentifier, eventCreatedAt) as identifier,
                  argMax(userDisplayName, eventCreatedAt) as displayName,
                  argMax(countryCode, eventCreatedAt) as countryCode,
                  max(eventCreatedAt) as maxCreatedAt,
                  max(eventCreatedAt) >= ${ONLINE_USERS_INTERVAL_QUERY} as isOnline
                FROM (
                  SELECT any(userId) as userId,
                    argMax(userIdentifier, createdAt) as userIdentifier,
                    argMax(userDisplayName, createdAt) as userDisplayName,
                    argMax(countryCode, createdAt) as countryCode,
                    max(createdAt) as eventCreatedAt
                  FROM ${TABLE_NAME}
                  WHERE projectId=${escape(projectId)}
                    ${userFilterQueries ? `AND (${userFilterQueries})` : ''}
                    ${filterQueries || ''}
                    ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
                  GROUP BY id
                  HAVING sum(sign) > 0
                )
                GROUP BY userId
              ) u
              ${joinClause}
              ${orderByClause}
              LIMIT ${escape(pagination.limit)} OFFSET ${escape(pagination.offset)}`,
        format: 'JSONEachRow',
      });
      const result = (await resultSet.json()) as Array<any>;
      return result.map((row) => {
        return {
          id: BigInt(row.userId),
          identifier: row.identifier as string,
          displayName: row.displayName as string,
          countryCode: row.countryCode as string,
          lastSeenAt: row[isSortByEvent ? 'lastEventFiredAt' : 'maxCreatedAt'] as string,
          isOnline: Boolean(row.isOnline),
        };
      });
    },
  ),
  getAllEventsCount: withSpan('getAllEventsCount', async (projectId: bigint) => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT count() FROM ${TABLE_NAME} WHERE projectId=${escape(projectId)} GROUP BY id HAVING sum(sign) > 0`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.length > 0 ? Number(result[0]['count()']) : 0;
  }),
  getEventsCountAcrossAllProjects: withSpan('getEventsCountAcrossAllProjects', async () => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT count(id) FROM ${TABLE_NAME} WHERE createdAt >= NOW() - INTERVAL 24 HOUR`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.length > 0 ? Number(result[0]['count(id)']) : 0;
  }),
  getPageViewTimeSeries: withSpan('getPageViewTimeSeries', async (projectId: bigint, filterOptions: FilterOptions) => {
    const { timeSpan, startDate, endDate, filterQueries, filterConfig } = filterOptions;
    const pageFilterQueries = buildPageFilterQueries(filterConfig);

    const resultSet = await clickhouseClient.query({
      query: `SELECT count(), ${formatDateExpression(
        { timeSpan, startDate, endDate },
        'createdAt',
      )} as date from ${TABLE_NAME} WHERE projectId=${escape(
        projectId,
      )} AND isPageView = 1 AND createdAt >= '${formatClickhouseDate(startDate)}'
      ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
      ${pageFilterQueries ? `AND (${pageFilterQueries})` : ''}
      ${filterQueries || ''} GROUP BY date;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    if (result.length === 0) {
      return null;
    }

    return result.map((row) => ({
      count: Number(row['count()']),
      date: row['date'],
    }));
  }),
  getActiveUserTimeSeries: withSpan(
    'getActiveUserTimeSeries',
    async (projectId: bigint, filterOptions: Omit<FilterOptions, 'filterConfig'>) => {
      const { timeSpan, startDate, endDate, filterQueries } = filterOptions;

      const resultSet = await clickhouseClient.query({
        query: `SELECT count(distinct userId) as users, ${formatDateExpression(
          { timeSpan, startDate, endDate },
          'createdAt',
        )} as date from ${TABLE_NAME} WHERE projectId=${escape(projectId)} AND createdAt >= '${formatClickhouseDate(
          startDate,
        )}' ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''} ${filterQueries} GROUP BY date;`,
        format: 'JSONEachRow',
      });
      const result = (await resultSet.json()) as Array<any>;
      if (result.length === 0) {
        return null;
      }

      return result.map((row) => ({
        count: Number(row['users']),
        date: row['date'],
      }));
    },
  ),
  getCurrentActiveUsers: withSpan('getCurrentActiveUsers', async (projectId: bigint, filterQueries?: string) => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT count(distinct userId) as users from ${TABLE_NAME} WHERE projectId=${escape(
        projectId,
      )} AND createdAt >= ${ONLINE_USERS_INTERVAL_QUERY} ${filterQueries || ''};`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return Number(result[0]['users']);
  }),
  getActiveUsers: withSpan(
    'getActiveUsers',
    async (projectId: bigint, options: { startDate: Date; endDate?: Date; filterQueries?: string }) => {
      const { startDate, endDate, filterQueries } = options;
      const resultSet = await clickhouseClient.query({
        query: `SELECT count(distinct userId) as users from ${TABLE_NAME} WHERE projectId=${escape(
          projectId,
        )} AND createdAt >= '${formatClickhouseDate(startDate)}' ${
          endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''
        }
        ${filterQueries || ''};`,
        format: 'JSONEachRow',
      });
      const result = (await resultSet.json()) as Array<any>;
      if (result.length === 0) {
        return null;
      }

      const firstResult = result[0];
      return Number(firstResult['users']);
    },
  ),
  getMostVisitedPages: withSpan('getMostVisitedPages', async (projectId: bigint, filterOptions: FilterOptions) => {
    const { startDate, endDate, filterQueries, filterConfig } = filterOptions;
    const pageFilterQueries = buildPageFilterQueries(filterConfig);

    const resultSet = await clickhouseClient.query({
      query: `SELECT origin, pathname, count() as pageViews, count(distinct userId) as users from event WHERE projectId=${escape(
        projectId,
      )} AND isPageView = 1 AND createdAt >= '${formatClickhouseDate(startDate)}' 
      ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
      ${pageFilterQueries ? ` AND (${pageFilterQueries}) ` : ''}
      ${filterQueries || ''} GROUP BY origin, pathname ORDER BY users DESC, pageViews DESC;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => ({
      origin: row.origin as string,
      pathname: row.pathname as string,
      pageViews: Number(row.pageViews),
      users: Number(row.users),
    }));
  }),
  getBrowsers: async (projectId: bigint, filterOptions: Omit<FilterOptions, 'timeSpan'>) => {
    const { startDate, endDate, filterQueries, filterConfig } = filterOptions;
    const browserFilterQueries = buildBrowserFilterQueries(filterConfig);

    const resultSet = await clickhouseClient.query({
      query: `SELECT clientName, count(distinct userId) as users from event WHERE projectId=${escape(
        projectId,
      )} AND isPageView = 1 AND clientType = 'browser' AND createdAt >= '${formatClickhouseDate(startDate)}' 
      ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
      ${browserFilterQueries ? ` AND (${browserFilterQueries}) ` : ''}
      ${filterQueries || ''} GROUP BY clientName ORDER BY users DESC;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => ({
      browserName: row.clientName as string,
      users: Number(row.users),
    }));
  },
  getDevices: async (projectId: bigint, filterOptions: Omit<FilterOptions, 'timeSpan'>) => {
    const { startDate, endDate, filterQueries, filterConfig } = filterOptions;
    const deviceFilterQueries = buildDeviceFilterQueries(filterConfig);

    const resultSet = await clickhouseClient.query({
      query: `SELECT deviceType, count(distinct userId) as users from event WHERE projectId=${escape(
        projectId,
      )} AND isPageView = 1 AND clientType = 'browser' AND createdAt >= '${formatClickhouseDate(startDate)}' 
      ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
      ${deviceFilterQueries ? ` AND (${deviceFilterQueries}) ` : ''}
      ${filterQueries || ''} GROUP BY deviceType ORDER BY users DESC;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => ({
      deviceType: row.deviceType as string,
      users: Number(row.users),
    }));
  },
  getOperatingSystems: async (projectId: bigint, filterOptions: Omit<FilterOptions, 'timeSpan'>) => {
    const { startDate, endDate, filterQueries, filterConfig } = filterOptions;
    const osFilterQueries = buildOsFilterQueries(filterConfig);

    const resultSet = await clickhouseClient.query({
      query: `SELECT osName, count(distinct userId) as users from event WHERE projectId=${escape(
        projectId,
      )} AND isPageView = 1 AND clientType = 'browser' AND createdAt >= '${formatClickhouseDate(startDate)}' 
      ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
      ${osFilterQueries ? ` AND (${osFilterQueries}) ` : ''}
      ${filterQueries || ''} GROUP BY osName ORDER BY users DESC;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => ({
      osName: row.osName as string,
      users: Number(row.users),
    }));
  },
  getEvents: withSpan('getEvents', async (projectId: bigint, filterOptions: FilterOptions) => {
    const { startDate, endDate, filterConfig, filterQueries } = filterOptions;
    const eventFilterQueries = buildEventFilterQueries(filterConfig);

    const resultSet = await clickhouseClient.query({
      query: `SELECT name, count() as count, count(distinct userId) as users from event WHERE projectId=${escape(
        projectId,
      )} AND isPageView <> 1 AND createdAt >= '${formatClickhouseDate(startDate)}' 
      ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
      ${eventFilterQueries ? `AND (${eventFilterQueries})` : ''}
      ${filterQueries || ''} GROUP BY name ORDER BY users DESC, count DESC;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => ({
      name: row.name as string,
      count: Number(row.count),
      users: Number(row.users),
    }));
  }),
  getEventsTimeSeries: withSpan('getEventsTimeSeries', async (projectId: bigint, filterOptions: FilterOptions) => {
    const { timeSpan, startDate, endDate, filterQueries, filterConfig } = filterOptions;
    const eventFilterQueries = buildEventFilterQueries(filterConfig);

    const resultSet = await clickhouseClient.query({
      query: `SELECT count(), ${formatDateExpression(
        { timeSpan, startDate, endDate },
        'createdAt',
      )} as date from event WHERE projectId=${escape(
        projectId,
      )} AND isPageView <> 1 AND createdAt >= '${formatClickhouseDate(startDate)}' ${
        endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''
      }
      ${eventFilterQueries ? `AND (${eventFilterQueries})` : ''}
      ${filterQueries || ''} GROUP BY date;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    if (result.length === 0) {
      return null;
    }

    return result.map((row) => ({
      count: Number(row['count()']),
      date: row['date'],
    }));
  }),
  getBounceRateTimeSeries: withSpan(
    'getBounceRateTimeSeries',
    async (projectId: bigint, filterOptions: FilterOptions) => {
      const { timeSpan, startDate, endDate, filterQueries } = filterOptions;

      const resultSet = await clickhouseClient.query({
        query: `
        WITH 
        sessions AS (
          SELECT 
            sessionId,
            ${formatDateExpression({ timeSpan, startDate, endDate }, 'createdAt')} as date,
            count() as pageViews
          FROM ${TABLE_NAME} 
          WHERE projectId=${escape(projectId)} 
            AND isPageView = 1 
            AND createdAt >= '${formatClickhouseDate(startDate)}'
            ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
            ${filterQueries || ''}
          GROUP BY sessionId, date
        )
        SELECT 
          date,
          countIf(pageViews = 1) as bounces,
          count() as totalSessions,
          round(countIf(pageViews = 1) / count() * 100, 2) as bounceRate
        FROM sessions
        GROUP BY date
        ORDER BY date;`,
        format: 'JSONEachRow',
      });
      const result = (await resultSet.json()) as Array<any>;
      if (result.length === 0) {
        return null;
      }

      return result.map((row) => ({
        date: row.date,
        count: Number(row.bounceRate),
        bounces: Number(row.bounces),
        totalSessions: Number(row.totalSessions),
      }));
    },
  ),

  /**
   * Analyze user progression through configured funnel steps using ClickHouse's windowFunnel
   * @param projectId - The project ID
   * @param steps - Array of funnel steps, each containing either pageview or event criteria
   * @param startDate - Start date for funnel analysis
   * @param endDate - Optional end date for funnel analysis, else it will analyze until now
   * @param windowHours - Maximum time window between first and last step
   * @param filterQueries - Optional filter queries to apply
   */
  getFunnelResults: async (
    projectId: bigint,
    steps: Array<FunnelStep>,
    startDate: Date,
    endDate?: Date,
    windowHours?: number,
    filterQueries?: string,
  ) => {
    const stepConditions = buildFunnelStepConditions(steps, projectId);
    const funnelSubquery = buildWindowFunnelSubquery(
      projectId,
      stepConditions,
      startDate,
      endDate,
      windowHours,
      filterQueries,
    );

    const resultSet = await clickhouseClient.query({
      query: `
      WITH funnel_data AS (${funnelSubquery})
      SELECT 
        stage as funnelStage,
        COUNT(*) as userCount
      FROM (
        SELECT 
          userId,
          maxStage,
          arrayJoin(range(1, maxStage + 1)) as stage
        FROM funnel_data
        WHERE maxStage > 0
      )
      GROUP BY stage
      ORDER BY stage`,
      format: 'JSONEachRow',
    });

    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => ({
      funnelStage: Number(row.funnelStage),
      userCount: Number(row.userCount),
    }));
  },
  getUsagePerProject: withSpan(
    'getUsagePerProject',
    async (projectIds: Array<string>, startDate: Date, endDate: Date) => {
      const resultSet = await clickhouseClient.query({
        query: `SELECT projectId, count() as events from ${TABLE_NAME} WHERE projectId IN (${projectIds
          .map((id) => escape(id))
          .join(',')}) 
        AND createdAt >= toStartOfDay(parseDateTimeBestEffortOrNull('${formatClickhouseDate(startDate)}'))
        AND createdAt < toStartOfDay(parseDateTimeBestEffortOrNull('${formatClickhouseDate(
          endDate,
        )}')) GROUP BY projectId`,
        format: 'JSONEachRow',
      });

      const result = (await resultSet.json()) as Array<any>;
      return result.map((row) => ({
        projectId: row.projectId,
        events: Number(row.events),
      }));
    },
  ),

  insert: async (events: Array<ClickhouseEvent>) => {
    await clickhouseInsert({
      table: TABLE_NAME,
      values: events.map((event) => ({ ...event, sign: 1 })),
    });
  },
  delete: async (events: Array<ClickhouseEvent>) => {
    await clickhouseInsert({
      table: TABLE_NAME,
      values: events.map((event) => ({ ...event, sign: -1 })),
    });
  },
  getEventCountsByDay: async (props: {
    projectId: bigint;
    userId: bigint;
    startDate: Date;
  }): Promise<Array<{ createdAt: string; count: number }>> => {
    const { projectId, userId, startDate } = props;

    const resultSet = await clickhouseClient.query({
      query: `
        SELECT date, count(*) as count FROM (
          SELECT toDate(any(createdAt)) as date
          FROM ${TABLE_NAME}
          WHERE projectId = ${escape(projectId)}
          AND userId = ${escape(userId)}
          AND createdAt >= '${formatClickhouseDate(startDate)}'
          GROUP BY id
          HAVING sum(sign) > 0 
        )
        GROUP BY date
        ORDER BY date ASC
      `,
      format: 'JSONEachRow',
    });

    const result = (await resultSet.json()) as Array<{ date: string; count: number }>;
    return result.map((row) => ({
      createdAt: row.date,
      count: Number(row.count),
    }));
  },
  getEventProperties: withSpan(
    'getEventProperties',
    async (projectId: bigint, eventName: string, filterOptions: Omit<FilterOptions, 'timeSpan'>) => {
      const { startDate, endDate, filterQueries, filterConfig } = filterOptions;
      const eventFilterQueries = buildEventFilterQueries(filterConfig);

      const resultSet = await clickhouseClient.query({
        query: `
          SELECT 
            arrayJoin(JSONExtractKeys(customData)) as property,
            count() as count,
            count(distinct userId) as users
          FROM ${TABLE_NAME}
          WHERE projectId = ${escape(projectId)}
            AND name = ${escape(eventName)}
            AND createdAt >= '${formatClickhouseDate(startDate)}'
            ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
            AND isPageView <> 1
            ${eventFilterQueries ? `AND (${eventFilterQueries})` : ''}
            ${filterQueries || ''}
          GROUP BY property
          ORDER BY count DESC
        `,
        format: 'JSONEachRow',
      });

      const result = (await resultSet.json()) as Array<any>;
      return result.map((row) => ({
        name: row.property as string,
        count: Number(row.count),
        users: Number(row.users),
      }));
    },
  ),
  getPropertyValues: withSpan(
    'getPropertyValues',
    async (projectId: bigint, eventName: string, property: string, filterOptions: Omit<FilterOptions, 'timeSpan'>) => {
      const { startDate, endDate, filterQueries, filterConfig } = filterOptions;
      const eventFilterQueries = buildEventFilterQueries(filterConfig);

      const resultSet = await clickhouseClient.query({
        query: `
          SELECT 
            JSONExtractString(customData, ${escape(property)}) as value,
            count() as count,
            count(distinct userId) as users
          FROM ${TABLE_NAME}
          WHERE projectId = ${escape(projectId)}
            AND name = ${escape(eventName)}
            AND createdAt >= '${formatClickhouseDate(startDate)}'
            ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
            AND isPageView <> 1
            AND JSONHas(customData, ${escape(property)})
            ${eventFilterQueries ? `AND (${eventFilterQueries})` : ''}
            ${filterQueries || ''}
          GROUP BY value
          ORDER BY count DESC
        `,
        format: 'JSONEachRow',
      });

      const result = (await resultSet.json()) as Array<any>;
      return result.map((row) => ({
        name: row.value as string,
        count: Number(row.count),
        users: Number(row.users),
      }));
    },
  ),
  getEventPropertiesAndValues: withSpan(
    'getEventPropertiesAndValues',
    async (projectId: bigint, eventName: string, startDate: Date, operator: z.infer<typeof stringOperatorsSchema>) => {
      const eventNameCondition = buildStringFilterQuery('name', { operator, value: eventName });

      const resultSet = await clickhouseClient.query({
        query: `
          SELECT
            arrayJoin(JSONExtractKeys(customData)) as property,
            JSONExtractString(customData, property) as value
          FROM ${TABLE_NAME}
          WHERE projectId = ${escape(projectId)}
            ${eventNameCondition ? `AND ${eventNameCondition}` : ''}
            AND createdAt >= '${formatClickhouseDate(startDate)}'
            AND isPageView <> 1
            AND JSONLength(customData) > 0
          GROUP BY property, value
          ORDER BY property, value
        `,
        format: 'JSONEachRow',
      });

      const result = (await resultSet.json()) as Array<any>;
      // Group by property
      const grouped: Record<string, string[]> = {};
      for (const row of result) {
        if (!grouped[row.property]) grouped[row.property] = [];
        grouped[row.property].push(row.value);
      }
      return grouped;
    },
  ),

  getLatestEventsByProjectId: withSpan(
    'getLatestEventsByProjectId',
    async (props: {
      projectId: bigint;
      limit?: number;
      cursor?: string;
      startDate?: Date;
      filterConfig?: IFilterConfig;
    }): Promise<Array<ClickhouseEvent>> => {
      const { projectId, limit = EVENT_LIMIT, cursor, startDate, filterConfig } = props;

      const cursorClause = cursor ? ` AND createdAt < ${escape(cursor)}` : '';

      // Build filter queries using the existing filter system, excluding 'page' filters since events page doesn't show page views
      const { filterQueries } = filterConfig
        ? getEventFilterQueries({
            filterConfig,
          })
        : { filterQueries: '' };

      const resultSet = await clickhouseClient.query({
        query: `
          SELECT ${EVENT_KEY_SELECTOR}, max(createdAt) as eventTime
          FROM ${TABLE_NAME} 
          WHERE projectId = ${escape(projectId)}${cursorClause}
          ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
          AND isPageView <> 1
          ${filterQueries || ''}
          GROUP BY id 
          HAVING sum(sign) > 0 
          ORDER BY eventTime DESC 
          LIMIT ${escape(limit)}`,
        format: 'JSONEachRow',
      });

      const rows = (await resultSet.json()) as Array<any>;
      return rows.map(mapRowToEvent);
    },
  ),

  /**
   * Get funnel progress for a specific user
   * Returns which funnels the user has completed (started first step)
   */
  getUserFunnelProgress: async (
    projectId: bigint,
    userId: bigint,
    funnels: Array<{ id: string; name: string; steps: FunnelStep[] }>,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Array<{ funnelId: string; funnelName: string; completedStep: number; totalSteps: number }>> => {
    if (funnels.length === 0) return [];

    const results = await Promise.all(
      funnels.map(async (funnel) => {
        const stepConditions = buildFunnelStepConditions(funnel.steps, projectId);
        const userCondition = `AND userId = ${escape(userId)}`;

        const funnelSubquery = buildWindowFunnelSubquery(
          projectId,
          stepConditions,
          startDate,
          endDate,
          undefined,
          userCondition,
        );

        const resultSet = await clickhouseClient.query({
          query: `
            WITH funnel_data AS (${funnelSubquery})
            SELECT 
              userId,
              maxStage as completedStep
            FROM funnel_data
            WHERE userId = ${escape(userId)}
            AND maxStage > 0
          `,
          format: 'JSONEachRow',
        });

        const result = (await resultSet.json()) as Array<{ userId: string; completedStep: number }>;

        if (result.length > 0) {
          return {
            funnelId: funnel.id,
            funnelName: funnel.name,
            completedStep: result[0].completedStep,
            totalSteps: funnel.steps.length,
          };
        }

        return null;
      }),
    );

    return results.filter((result): result is NonNullable<typeof result> => result !== null);
  },
};
