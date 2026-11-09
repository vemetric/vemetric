import { isTimespanAllowed, type TimeSpan } from '@vemetric/common/charts/timespans';
import { addDays, isBefore } from 'date-fns';

export const RETENTION_UPGRADE_MESSAGE = 'Upgrade to the Professional plan for longer data retention';

/** How far back the free plan includes data. */
export const FREE_PLAN_RETENTION_DAYS = 30;
/** Custom ranges may start a little earlier, so a range starting "30 days ago" isn't rejected because of time zones. */
const RETENTION_GRACE_DAYS = 2;

type RetentionAccessParams = {
  timespan: TimeSpan;
  startDate: Date;
  isSubscriptionActive: boolean;
};

export function isRetentionRestricted({ timespan, startDate, isSubscriptionActive }: RetentionAccessParams): boolean {
  if (timespan === 'custom' && !isSubscriptionActive) {
    return isBefore(startDate, addDays(new Date(), -(FREE_PLAN_RETENTION_DAYS + RETENTION_GRACE_DAYS)));
  }

  return !isTimespanAllowed(timespan, isSubscriptionActive);
}
