import { isTimespanAllowed, type TimeSpan } from '@vemetric/common/charts/timespans';
import { addDays, isBefore } from 'date-fns';

export const RETENTION_UPGRADE_MESSAGE = 'Upgrade to the Professional plan for longer data retention';

type RetentionAccessParams = {
  timespan: TimeSpan;
  startDate: Date;
  isSubscriptionActive: boolean;
};

export function isRetentionRestricted({ timespan, startDate, isSubscriptionActive }: RetentionAccessParams): boolean {
  if (timespan === 'custom' && !isSubscriptionActive) {
    return isBefore(startDate, addDays(new Date(), -32));
  }

  return !isTimespanAllowed(timespan, isSubscriptionActive);
}
