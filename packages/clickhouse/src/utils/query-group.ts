import { escape } from 'sqlstring';

export const eventPropertyTokenRegex = /^event:prop:([^\r\n]+)$/;
export const metricsGroupFieldTokens = [
  'country',
  'city',
  'page:origin',
  'page:path',
  'browser',
  'deviceType',
  'os',
  'referrer',
  'referrerType',
  'utmCampaign',
  'utmContent',
  'utmMedium',
  'utmSource',
  'utmTerm',
  'event:name',
] as const;

type MetricsGroupFieldToken = (typeof metricsGroupFieldTokens)[number];

/** Fixed time series intervals, next to `interval:auto` which picks one from the length of the period. */
export const metricsGroupIntervalTokens = {
  'interval:hour': 'hourly',
  'interval:day': 'daily',
  'interval:week': 'weekly',
  'interval:month': 'monthly',
} as const;
type MetricsGroupIntervalToken = keyof typeof metricsGroupIntervalTokens;

/**
 * Group by the user's first visit ever (first-touch attribution), stored on the user row when a user is identified.
 * Anonymous users have no user row and are grouped under "".
 */
export const metricsGroupFirstVisitTokens = {
  'firstVisit:referrer': 'referrer',
  'firstVisit:referrerType': 'referrerType',
  'firstVisit:utmCampaign': 'utmCampaign',
  'firstVisit:utmContent': 'utmContent',
  'firstVisit:utmMedium': 'utmMedium',
  'firstVisit:utmSource': 'utmSource',
  'firstVisit:utmTerm': 'utmTerm',
  'firstVisit:page:origin': 'origin',
  'firstVisit:page:path': 'pathname',
} as const;
export type MetricsGroupFirstVisitToken = keyof typeof metricsGroupFirstVisitTokens;
type MetricsGroupScope = 'event' | 'session';

export type MetricsQueryGrouping =
  | { kind: 'none' }
  | { kind: 'field'; token: MetricsGroupFieldToken }
  | {
      kind: 'interval';
      interval: string;
    }
  | {
      kind: 'event_prop';
      token: string;
      property: string;
    }
  | {
      kind: 'first_visit';
      token: MetricsGroupFirstVisitToken;
      field: (typeof metricsGroupFirstVisitTokens)[MetricsGroupFirstVisitToken];
    };

export function parseMetricsQueryGroupingToken(token: string | null): MetricsQueryGrouping {
  if (!token) {
    return { kind: 'none' };
  }

  if (metricsGroupFieldTokens.includes(token as MetricsGroupFieldToken)) {
    return { kind: 'field', token: token as MetricsGroupFieldToken };
  }

  if (token === 'interval:auto') {
    return { kind: 'interval', interval: 'auto' };
  }

  if (token in metricsGroupIntervalTokens) {
    return { kind: 'interval', interval: metricsGroupIntervalTokens[token as MetricsGroupIntervalToken] };
  }

  if (token in metricsGroupFirstVisitTokens) {
    const firstVisitToken = token as MetricsGroupFirstVisitToken;
    return { kind: 'first_visit', token: firstVisitToken, field: metricsGroupFirstVisitTokens[firstVisitToken] };
  }

  const match = token.match(eventPropertyTokenRegex);
  if (match) {
    return { kind: 'event_prop', token, property: match[1] };
  }

  return { kind: 'none' };
}

function getFieldExpression(token: MetricsGroupFieldToken, scope: MetricsGroupScope): string | null {
  const sharedFields: Record<
    Exclude<MetricsGroupFieldToken, 'page:origin' | 'page:path' | 'browser' | 'deviceType' | 'os' | 'event:name'>,
    string
  > = {
    country: 'countryCode',
    city: 'city',
    referrer: 'referrer',
    referrerType: 'referrerType',
    utmCampaign: 'utmCampaign',
    utmContent: 'utmContent',
    utmMedium: 'utmMedium',
    utmSource: 'utmSource',
    utmTerm: 'utmTerm',
  };

  if (token in sharedFields) {
    return sharedFields[token as keyof typeof sharedFields];
  }

  if (token === 'page:origin') {
    return scope === 'event' ? 'origin' : null;
  }

  if (token === 'page:path') {
    return scope === 'event' ? 'pathname' : null;
  }

  if (token === 'browser') {
    return scope === 'event' ? 'clientName' : null;
  }

  if (token === 'deviceType') {
    return scope === 'event' ? 'deviceType' : null;
  }

  if (token === 'os') {
    return scope === 'event' ? 'osName' : null;
  }

  if (token === 'event:name') {
    return scope === 'event' ? 'name' : null;
  }

  return null;
}

export function getMetricsGroupExpression(grouping: MetricsQueryGrouping, scope: MetricsGroupScope): string | null {
  if (grouping.kind === 'field') {
    return getFieldExpression(grouping.token, scope);
  }

  if (grouping.kind === 'interval') {
    const dateField = scope === 'event' ? 'createdAt' : 'startedAt';

    switch (grouping.interval) {
      case 'thirty_seconds':
        return `toStartOfInterval(${dateField}, INTERVAL 30 SECOND)`;
      case 'ten_minutes':
        return `toStartOfTenMinutes(${dateField})`;
      case 'hourly':
        return `toStartOfHour(${dateField})`;
      case 'daily':
        return `toStartOfDay(${dateField})`;
      case 'weekly':
        return `toStartOfWeek(${dateField})`;
      case 'monthly':
        return `toStartOfMonth(${dateField})`;
      default:
        return `toStartOfDay(${dateField})`;
    }
  }

  if (grouping.kind === 'event_prop') {
    return `JSONExtractString(customData, ${escape(grouping.property ?? '')})`;
  }

  if (grouping.kind === 'first_visit') {
    return 'firstVisit.firstVisitValue';
  }

  return "'__all__'";
}

/**
 * The join a grouping needs after the `FROM` of an event or session query: for the first visit, the users' first-visit
 * field by `userId` (anonymous users don't match and get "", ClickHouse's default without `join_use_nulls`).
 */
export function getMetricsGroupJoin(grouping: MetricsQueryGrouping, projectId: bigint): string {
  if (grouping.kind !== 'first_visit') {
    return '';
  }

  return `LEFT JOIN (
      SELECT id AS firstVisitUserId, argMax(${grouping.field}, updatedAt) AS firstVisitValue
      FROM user
      WHERE projectId = ${escape(projectId)}
      GROUP BY id
      HAVING argMax(deleted, updatedAt) = 0
    ) AS firstVisit ON userId = firstVisit.firstVisitUserId`;
}
