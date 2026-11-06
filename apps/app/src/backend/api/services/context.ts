import type { TimeSpan } from '@vemetric/common/charts/timespans';
import type { Project } from 'database';
import type { SubscriptionStatus } from '../../utils/billing';
import { isRetentionRestricted, RETENTION_UPGRADE_MESSAGE } from '../../utils/retention';
import { ApiError } from '../utils/errors';

/**
 * Everything a service function needs to know about the caller. The REST API builds it from the API key,
 * the MCP server (and later OAuth) can build it for any project the caller has access to.
 */
export type ApiServiceContext = {
  project: Project;
  subscriptionStatus: SubscriptionStatus;
};

export function assertRetentionAllowed(
  { subscriptionStatus }: ApiServiceContext,
  { timespan, startDate }: { timespan: TimeSpan; startDate: Date },
) {
  if (
    isRetentionRestricted({
      timespan,
      startDate,
      isSubscriptionActive: subscriptionStatus.isActive,
    })
  ) {
    throw new ApiError(403, 'PLAN_LIMIT_EXCEEDED', RETENTION_UPGRADE_MESSAGE);
  }
}
