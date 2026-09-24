import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { formatClickhouseDate } from '@vemetric/common/date';
import type { IFilterConfig } from '@vemetric/common/filters';
import type { GeoData } from '@vemetric/common/geo';
import { jsonStringify } from '@vemetric/common/json';
import type { ISources } from '@vemetric/common/sources';
import { escape } from 'sqlstring';
import { clickhouseClient, clickhouseInsert } from '../client';
import { formatDateExpression } from '../utils/date';
import { buildLocationFilterQueries } from '../utils/filters/location-filter';
import { buildSourceFilterQueries } from '../utils/filters/source-filter';
import type { MetricsQueryGrouping } from '../utils/query-group';
import { getMetricsGroupExpression } from '../utils/query-group';
import { withSpan } from '../utils/with-span';

const TABLE_NAME = 'session_v3';

export interface FilterOptions {
  timeSpan: TimeSpan;
  startDate: Date;
  endDate?: Date;
  filterQueries: string;
  filterConfig: IFilterConfig;
}

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
    deleted?: number;
  };

export interface SessionRevisionRow extends Omit<
  ClickhouseSession,
  'projectId' | 'userId' | 'queryParams' | 'userIdentifier' | 'userDisplayName'
> {
  projectId: string;
  userId: string;
  revision: string;
  deleted: number;
  queryParams: string;
  userIdentifier: string | null;
  userDisplayName: string | null;
}

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
  deleted: 0,
};

// Wrap values so argMax preserves NULL from the winning revision. Retries of a
// revision must contain the same snapshot; separate aggregates allow column pruning.
const transformKeySelector = (key: keyof ClickhouseSession) =>
  key === 'projectId' || key === 'id' ? key : `argMax(tuple(${key}), revision).1 AS ${key}`;
const SESSION_KEYS = Object.keys(EXAMPLE_SESSION) as Array<keyof ClickhouseSession>;
const SESSION_KEY_SELECTOR = SESSION_KEYS.join(',');
// Every mapped column resolves to the highest revision; `deleted` is the tombstone flag.
const CURRENT_SESSION_KEY_SELECTOR = SESSION_KEYS.map(transformKeySelector).join(', ');
const BIGINT_KEYS = SESSION_KEYS.filter((key) => typeof EXAMPLE_SESSION[key] === 'bigint');

export interface CurrentSessionRowsOptions {
  // Either explicit ids or a subquery that yields candidate ids (used for per-user lookups so the
  // candidate scan happens inside the same statement).
  ids?: readonly string[] | { subquery: string };
  startDate?: Date;
  endDate?: Date;
}

export function currentSessionRows(projectId: bigint, { ids, startDate, endDate }: CurrentSessionRowsOptions = {}) {
  const idFilter =
    ids === undefined
      ? ''
      : 'subquery' in ids
        ? ` AND ${TABLE_NAME}.id IN (${ids.subquery})`
        : ids.length
          ? ` AND ${TABLE_NAME}.id IN (${ids.map((id) => escape(id)).join(',')})`
          : ' AND 0';

  const startFilter = startDate ? ` AND ${TABLE_NAME}.startedAt >= '${formatClickhouseDate(startDate)}'` : '';
  const endFilter = endDate ? ` AND ${TABLE_NAME}.startedAt < '${formatClickhouseDate(endDate)}'` : '';
  return `(SELECT ${CURRENT_SESSION_KEY_SELECTOR}
    FROM ${TABLE_NAME}
    WHERE ${TABLE_NAME}.projectId = ${escape(projectId)}${idFilter}${startFilter}${endFilter}
    GROUP BY projectId, id
    HAVING deleted = 0)`;
}

function mapRowToSession(row: any): ClickhouseSession {
  const session: ClickhouseSession = JSON.parse(jsonStringify(EXAMPLE_SESSION));

  SESSION_KEYS.forEach((key) => {
    const keyValue = row[key];
    if (key === 'queryParams') {
      session.queryParams = JSON.parse(keyValue || '{}');
    } else if (BIGINT_KEYS.includes(key)) {
      (session as any)[key] = BigInt(keyValue);
    } else {
      (session as any)[key] = keyValue;
    }
  });

  return session;
}

/**
 * Candidate ids whose current or previous owner is this user. It is over-inclusive (any revision
 * ever owned by the user) and relies on the user_id_idx bloom-filter skip index so the scan is
 * bounded by the user's rows instead of the project.
 */
function candidateSessionIdsSubquery(projectId: bigint, userId: bigint) {
  return `SELECT DISTINCT id FROM ${TABLE_NAME}
    WHERE projectId = ${escape(projectId)} AND userId = ${escape(userId)}`;
}

export const clickhouseSession = {
  // Raw latest revision, including tombstones, for the ingestion state cache.
  findLatestRevision: async (projectId: bigint | string, id: string) => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT * FROM ${TABLE_NAME} WHERE projectId = {projectId:UInt64} AND id = {id:String} ORDER BY revision DESC LIMIT 1`,
      query_params: { projectId: String(projectId), id },
      format: 'JSONEachRow',
    });
    const [row] = await resultSet.json<SessionRevisionRow>();
    return row ?? null;
  },
  insertRevisions: async (rows: Record<string, unknown>[]) => {
    if (rows.length) await clickhouseInsert({ table: TABLE_NAME, values: rows });
  },
  findById: async (projectId: bigint, userId: bigint, id: string): Promise<ClickhouseSession | null> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${SESSION_KEY_SELECTOR} FROM ${currentSessionRows(projectId, { ids: [id] })} WHERE userId=${escape(userId)} LIMIT 1`,
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
    const idList = Array.from(ids);
    if (idList.length === 0) return [];
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${SESSION_KEY_SELECTOR} FROM ${currentSessionRows(projectId, { ids: idList })} WHERE userId=${escape(userId)}`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => mapRowToSession(row));
  },
  findByUserId: async (projectId: bigint, userId: bigint): Promise<Array<ClickhouseSession>> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${SESSION_KEY_SELECTOR} FROM ${currentSessionRows(projectId, { ids: { subquery: candidateSessionIdsSubquery(projectId, userId) } })} WHERE userId=${escape(userId)}`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => mapRowToSession(row));
  },
  findLatestByUserId: async (projectId: bigint, userId: bigint): Promise<ClickhouseSession | null> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${SESSION_KEY_SELECTOR} FROM ${currentSessionRows(projectId, { ids: { subquery: candidateSessionIdsSubquery(projectId, userId) } })} WHERE userId=${escape(userId)} ORDER BY endedAt DESC LIMIT 1`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    if (result.length === 0) {
      return null;
    }
    return mapRowToSession(result[0]);
  },
  getVisitDurationTimeSeries: withSpan(
    'getVisitDurationTimeSeries',
    async (projectId: bigint, filterOptions: FilterOptions) => {
      const { timeSpan, startDate, endDate, filterQueries } = filterOptions;

      const resultSet = await clickhouseClient.query({
        query: `
        SELECT 
          avg(duration) as avgDuration,
          count(*) as sessionCount,
          ${formatDateExpression({ timeSpan, startDate, endDate }, 'endedAt')} as date
        FROM ${currentSessionRows(projectId, { startDate, endDate })}
          WHERE duration > 0
            ${(filterQueries || '').replace('sessionId', 'id')}
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
              FROM ${currentSessionRows(projectId, { startDate, endDate })}
              WHERE 1=1
              ${locationFilterQueries ? `AND (${locationFilterQueries})` : ''}
              ${(filterQueries || '').replace('sessionId', 'id')}
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
  getCities: async (projectId: bigint, filterOptions: Omit<FilterOptions, 'timeSpan'>) => {
    const { startDate, endDate, filterQueries, filterConfig } = filterOptions;
    const locationFilterQueries = buildLocationFilterQueries(filterConfig);

    const resultSet = await clickhouseClient.query({
      query: `WITH lowerUTF8(trim(city)) as normalizedCity
              SELECT
                if(normalizedCity = '' OR normalizedCity = 'unknown', '', city) as cityGroup,
                if(normalizedCity = '' OR normalizedCity = 'unknown', '', countryCode) as countryCodeGroup,
                count(distinct userId) as users
              FROM ${currentSessionRows(projectId, { startDate, endDate })}
              WHERE 1=1
              ${locationFilterQueries ? `AND (${locationFilterQueries})` : ''}
              ${(filterQueries || '').replace('sessionId', 'id')}
              GROUP BY cityGroup, countryCodeGroup
              ORDER BY users DESC;`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => ({
      city: row.cityGroup as string,
      countryCode: row.countryCodeGroup as string,
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
      query: `SELECT ${selectColumns.join(', ')}, count(distinct userId) as users from ${currentSessionRows(projectId, { startDate, endDate })} WHERE 1=1
       ${notEmptyFilter} ${(filterQueries || '').replace('sessionId', 'id')} ${
         sourceFilterQueries ? `AND (${sourceFilterQueries})` : ''
       } GROUP BY ${source} ORDER BY users DESC;`,
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
  queryApiVisitDurationRows: withSpan(
    'queryApiVisitDurationRows',
    async (input: {
      projectId: bigint;
      startDate: Date;
      endDate?: Date;
      grouping: MetricsQueryGrouping;
      filterQueries: string;
    }) => {
      const { projectId, startDate, endDate, grouping, filterQueries } = input;
      const groupExpression = getMetricsGroupExpression(grouping, 'session');
      if (!groupExpression) {
        return [];
      }

      const resultSet = await clickhouseClient.query({
        query: `
      SELECT ${groupExpression} as groupKey, avg(duration) as metricValue
        FROM ${currentSessionRows(projectId, { startDate, endDate })}
        WHERE duration > 0
          ${(filterQueries || '').replace(/sessionId/g, 'id')}
      GROUP BY groupKey
    `,
        format: 'JSONEachRow',
      });

      const rows = (await resultSet.json()) as Array<{ groupKey: string; metricValue: number | string }>;
      return rows.map((row) => ({
        groupKey: String(row.groupKey ?? ''),
        value: Number(row.metricValue),
      }));
    },
  ),
};
