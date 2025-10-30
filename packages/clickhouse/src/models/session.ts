import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { formatClickhouseDate, getClickhouseDateNow } from '@vemetric/common/date';
import type { IFilterConfig } from '@vemetric/common/filters';
import { jsonStringify } from '@vemetric/common/json';
import type { ISources } from '@vemetric/common/sources';
import { escape } from 'sqlstring';
import { clickhouseClient, clickhouseInsert } from '../client';
import { formatDateExpression } from '../utils/date';
import { buildLocationFilterQueries } from '../utils/filters/location-filter';
import { buildSourceFilterQueries } from '../utils/filters/source-filter';
import { withSpan } from '../utils/with-span';

export interface FilterOptions {
  timeSpan: TimeSpan;
  startDate: Date;
  endDate?: Date;
  filterQueries: string;
  filterConfig: IFilterConfig;
}

const TABLE_NAME = 'session';

export type UrlData = {
  origin?: string;
  pathname?: string;
  urlHash?: string;
  queryParams?: Record<string, any>;

  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

export type ReferrerData = {
  referrer?: string;
  referrerUrl?: string;
  referrerType?: string;
};

export type GeoData = {
  countryCode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
};

export const EXAMPLE_URL_DATA: Required<UrlData> = {
  origin: '',
  pathname: '',
  urlHash: '',
  queryParams: {},
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  utmContent: '',
  utmTerm: '',
};

export type ClickhouseSession = UrlData &
  ReferrerData &
  GeoData & {
    projectId: bigint;
    userId: bigint;
    id: string;
    userIdentifier?: string;
    userDisplayName?: string;
    startedAt: string;
    endedAt: string;
    duration: number;

    userAgent?: string;

    importSource?: string;
  };

const EXAMPLE_SESSION: Required<ClickhouseSession> = {
  ...EXAMPLE_URL_DATA,
  projectId: BigInt(1),
  userId: BigInt(1),
  id: '',
  userIdentifier: '',
  userDisplayName: '',
  startedAt: '',
  endedAt: '',
  duration: 1,
  countryCode: '',
  city: '',
  latitude: null,
  longitude: null,
  userAgent: '',
  referrer: '',
  referrerUrl: '',
  referrerType: '',
  importSource: '',
};

const transformKeySelector = (key: keyof ClickhouseSession) => (key === 'id' ? key : `argMax(${key}, endedAt)`);
const SESSION_KEYS = Object.keys(EXAMPLE_SESSION) as Array<keyof ClickhouseSession>;
const SESSION_KEY_SELECTOR = SESSION_KEYS.map(transformKeySelector).join(',');
const JSON_KEYS = SESSION_KEYS.filter((key) => typeof EXAMPLE_SESSION[key] === 'object');
const BIGINT_KEYS = SESSION_KEYS.filter((key) => typeof EXAMPLE_SESSION[key] === 'bigint');

function mapRowToSession(row: any): ClickhouseSession {
  const session: ClickhouseSession = JSON.parse(jsonStringify(EXAMPLE_SESSION));

  SESSION_KEYS.forEach((key) => {
    const keyValue = row[transformKeySelector(key)];
    if (JSON_KEYS.includes(key)) {
      (session as any)[key] = keyValue ? JSON.parse(keyValue) : undefined;
    } else if (BIGINT_KEYS.includes(key)) {
      (session as any)[key] = BigInt(keyValue);
    } else {
      (session as any)[key] = keyValue;
    }
  });

  return session;
}

export const clickhouseSession = {
  findById: async (projectId: bigint, userId: bigint, id: string): Promise<ClickhouseSession | null> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${SESSION_KEY_SELECTOR} FROM ${TABLE_NAME} WHERE projectId=${escape(
        projectId,
      )} AND userId=${escape(userId)} AND id=${escape(id)} GROUP BY id HAVING argMax(deleted, endedAt) = 0 LIMIT 1`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return mapRowToSession(row);
  },
  findByIds: async (projectId: bigint, userId: bigint, ids: Set<string>): Promise<Array<ClickhouseSession>> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${SESSION_KEY_SELECTOR} FROM ${TABLE_NAME} WHERE projectId=${escape(
        projectId,
      )} AND userId=${escape(userId)} AND id IN (${Array.from(ids)
        .map((id) => escape(id))
        .join(',')}) GROUP BY id HAVING argMax(deleted, endedAt) = 0`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => {
      return mapRowToSession(row);
    });
  },
  findByUserId: async (projectId: bigint, userId: bigint): Promise<Array<ClickhouseSession>> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${SESSION_KEY_SELECTOR} FROM ${TABLE_NAME} WHERE projectId=${escape(
        projectId,
      )} AND userId=${escape(userId)} GROUP BY id HAVING argMax(deleted, endedAt) = 0`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => {
      return mapRowToSession(row);
    });
  },
  findByUserIdInTimeRange: async (
    projectId: bigint,
    userId: bigint,
    startTime: Date,
    endTime: Date,
  ): Promise<Array<ClickhouseSession>> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${SESSION_KEY_SELECTOR} FROM ${TABLE_NAME} 
        WHERE projectId=${escape(projectId)} 
          AND userId=${escape(userId)}
          AND startedAt <= '${formatClickhouseDate(endTime)}'
          AND endedAt >= '${formatClickhouseDate(startTime)}'
        GROUP BY id 
        HAVING argMax(deleted, endedAt) = 0`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => {
      return mapRowToSession(row);
    });
  },
  insert: async (sessions: Array<ClickhouseSession>) => {
    await clickhouseInsert({
      table: TABLE_NAME,
      values: sessions,
    });
  },
  delete: async (sessions: Array<Pick<ClickhouseSession, 'projectId' | 'userId' | 'startedAt'>>) => {
    const now = getClickhouseDateNow();
    await clickhouseInsert({
      table: TABLE_NAME,
      values: sessions.map((session) => ({ ...session, endedAt: now, deleted: 1 })),
    });
  },
  getVisitDurationTimeSeries: withSpan(
    'getVisitDurationTimeSeries',
    async (projectId: bigint, filterOptions: FilterOptions) => {
      const { timeSpan, startDate, endDate, filterQueries } = filterOptions;

      const resultSet = await clickhouseClient.query({
        query: `
        SELECT 
          avg(maxDuration) as avgDuration,
          count(*) as sessionCount,
          ${formatDateExpression({ timeSpan, startDate, endDate }, 'maxEndedAt')} as date 
        FROM (
          SELECT 
            id,
            argMax(duration, endedAt) as maxDuration,
            max(endedAt) as maxEndedAt
          FROM ${TABLE_NAME} 
          WHERE projectId=${escape(projectId)} 
            AND startedAt >= '${formatClickhouseDate(startDate)}'
            ${endDate ? `AND startedAt < '${formatClickhouseDate(endDate)}'` : ''}
            ${(filterQueries || '').replace('sessionId', 'id')}
          GROUP BY id
          HAVING argMax(deleted, endedAt) = 0 AND maxDuration > 0
        )
        GROUP BY date
        ORDER BY date ASC
      `,
        format: 'JSONEachRow',
      });
      const result = (await resultSet.json()) as Array<any>;
      if (result.length === 0) {
        return null;
      }

      return result.map((row) => ({
        count: Number(row['avgDuration']),
        sessionCount: Number(row['sessionCount']),
        date: row['date'],
      }));
    },
  ),
  getCountryCodes: async (projectId: bigint, filterOptions: Omit<FilterOptions, 'timeSpan'>) => {
    const { startDate, endDate, filterQueries, filterConfig } = filterOptions;
    const locationFilterQueries = buildLocationFilterQueries(filterConfig);

    const resultSet = await clickhouseClient.query({
      query: `SELECT countryCode, count(distinct userId) as users 
              FROM ${TABLE_NAME} 
              WHERE projectId=${escape(projectId)} 
              AND startedAt >= '${formatClickhouseDate(startDate)}' 
              ${endDate ? `AND startedAt < '${formatClickhouseDate(endDate)}'` : ''}
              ${locationFilterQueries ? `AND (${locationFilterQueries})` : ''}
              ${(filterQueries || '').replace('sessionId', 'id')}
              AND deleted = 0
              GROUP BY countryCode 
              ORDER BY users DESC;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => ({
      countryCode: row.countryCode as string,
      users: Number(row.users),
    }));
  },
  getTopSources: async (projectId: bigint, source: ISources, filterOptions: Omit<FilterOptions, 'timeSpan'>) => {
    const { startDate, endDate, filterQueries, filterConfig } = filterOptions;
    const sourceFilterQueries = buildSourceFilterQueries(filterConfig, source);

    const transformColumn = (column: ISources) => {
      if (column === source) {
        return column;
      }
      return `any(${column}) as ${column}`;
    };

    const selectColumns = [
      transformColumn('referrer'),
      source === 'referrerUrl' ? 'referrerUrl' : `anyIf(referrerUrl, referrerUrl <> '') as referrerUrl`,
      transformColumn('referrerType'),
      transformColumn('utmCampaign'),
      transformColumn('utmContent'),
      transformColumn('utmMedium'),
      transformColumn('utmSource'),
      transformColumn('utmTerm'),
    ];
    const notEmptyFilter = source === 'referrer' ? '' : `AND ${source} <> ''`;

    const resultSet = await clickhouseClient.query({
      query: `SELECT ${selectColumns.join(', ')}, count(distinct userId) as users from session WHERE projectId=${escape(
        projectId,
      )} AND startedAt >= '${formatClickhouseDate(startDate)}'
       ${endDate ? `AND startedAt < '${formatClickhouseDate(endDate)}'` : ''}
       ${notEmptyFilter} ${(filterQueries || '').replace('sessionId', 'id')} ${
         sourceFilterQueries ? `AND (${sourceFilterQueries})` : ''
       } AND deleted = 0 GROUP BY ${source} ORDER BY users DESC;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => ({
      referrer: row.referrer as string,
      referrerUrl: row.referrerUrl as string,
      referrerType: row.referrerType as string,
      utmCampaign: row.utmCampaign as string,
      utmContent: row.utmContent as string,
      utmMedium: row.utmMedium as string,
      utmSource: row.utmSource as string,
      utmTerm: row.utmTerm as string,
      users: Number(row.users),
    }));
  },
};
