import * as Sentry from '@sentry/bun';

export const withSpan = <Arguments extends unknown[], Results>(
  name: string,
  fn: (...args: Arguments) => Promise<Results>,
) => {
  return (...args: Arguments) =>
    Sentry.startSpan(
      {
        name,
        op: 'clickhouse.metrics',
      },
      () => fn(...args),
    );
};
