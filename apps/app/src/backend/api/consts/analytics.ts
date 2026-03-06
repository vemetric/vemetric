export const METRICS = ['users', 'pageviews', 'events', 'bounceRate', 'visitDuration'] as const;
export type Metric = (typeof METRICS)[number];
export const METRICS_SET = new Set<Metric>(METRICS);
export const DEFAULT_METRICS: Metric[] = ['users', 'pageviews', 'events'];

export type MetricRow = {
  groupKey: string;
  value: number;
};
