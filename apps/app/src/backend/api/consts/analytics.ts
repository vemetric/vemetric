export const METRICS = ['users', 'pageviews', 'events', 'bounce_rate', 'visit_duration'] as const;
export const METRICS_SET = new Set<string>(METRICS);
export const DEFAULT_METRICS = [...METRICS];

export type Metric = (typeof METRICS)[number];

export type MetricRow = {
  groupKey: string;
  value: number;
};
