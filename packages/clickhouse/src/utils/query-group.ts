import { escape } from 'sqlstring';

export const eventPropertyTokenRegex = /^event:prop:([^\r\n]+)$/;
export const metricsGroupFieldTokens = [
  'country',
  'city',
  'page:origin',
  'page:path',
  'browser',
  'device_type',
  'os',
  'referrer',
  'referrer_type',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
  'event:name',
] as const;

type MetricsGroupFieldToken = (typeof metricsGroupFieldTokens)[number];
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

  const match = token.match(eventPropertyTokenRegex);
  if (match) {
    return { kind: 'event_prop', token, property: match[1] };
  }

  return { kind: 'none' };
}

function getFieldExpression(token: MetricsGroupFieldToken, scope: MetricsGroupScope): string | null {
  const sharedFields: Record<
    Exclude<
      MetricsGroupFieldToken,
      'page:origin' | 'page:path' | 'browser' | 'device_type' | 'os' | 'event:name'
    >,
    string
  > = {
    country: 'countryCode',
    city: 'city',
    referrer: 'referrer',
    referrer_type: 'referrerType',
    utm_campaign: 'utmCampaign',
    utm_content: 'utmContent',
    utm_medium: 'utmMedium',
    utm_source: 'utmSource',
    utm_term: 'utmTerm',
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

  if (token === 'device_type') {
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
    return scope === 'event' ? 'toStartOfDay(createdAt)' : 'toStartOfDay(startedAt)';
  }

  if (grouping.kind === 'event_prop') {
    return `JSONExtractString(customData, ${escape(grouping.property ?? '')})`;
  }

  return "'__all__'";
}
