import { escape } from 'sqlstring';

export const eventPropertyTokenRegex = /^event:prop:([^\r\n]+)$/;

export type MetricsQueryGrouping =
  | { kind: 'none' }
  | {
      kind: 'country';
    }
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

  if (token === 'country') {
    return { kind: 'country' };
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

export function getMetricsGroupExpression(grouping: MetricsQueryGrouping): string {
  if (grouping.kind === 'country') {
    return 'countryCode';
  }

  if (grouping.kind === 'interval') {
    return 'toStartOfDay(createdAt)';
  }

  if (grouping.kind === 'event_prop') {
    return `JSONExtractString(customData, ${escape(grouping.property ?? '')})`;
  }

  return "'__all__'";
}
