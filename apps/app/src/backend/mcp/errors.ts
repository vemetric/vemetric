import type { PresetTimeSpan } from '@vemetric/common/charts/timespans';
import { getVemetricUrl } from '@vemetric/common/env';
import { addDays } from 'date-fns';
import { formatApiDay } from '../api/utils/date';
import type { ApiError } from '../api/utils/errors';
import { FREE_PLAN_RETENTION_DAYS } from '../utils/retention';

/** Where users choose which projects an app connected via OAuth can access (Account settings > Connected apps). */
export function getConnectedAppsUrl(): string {
  return `${getVemetricUrl('app')}/?settings=apps`;
}

type ToolErrorContext = {
  /** Whether the caller is an app connected via OAuth (rather than an API key). */
  isOauth?: boolean;
  /** The organization of the project, if known, for the billing link. */
  organizationId: string | undefined;
  input: unknown;
};

/** Error messages that tell the model what went wrong and how to recover, instead of retrying blindly. */
export function getToolErrorMessage(error: ApiError, { organizationId, input, isOauth }: ToolErrorContext): string {
  switch (error.code) {
    case 'PLAN_LIMIT_EXCEEDED':
      return getPlanLimitMessage(organizationId, input);
    case 'PROJECT_REQUIRED':
      return `${error.message} Call list_projects to see the projects you can access, then pass the projectId of the one the user means. Ask the user if it's unclear which project they mean.`;
    case 'PROJECT_NOT_FOUND':
      return isOauth
        ? `No project with this projectId is shared with this app. Call list_projects to see the projects you can access. The user can share more projects in Vemetric under Account settings > Connected apps: ${getConnectedAppsUrl()}`
        : 'No project with this projectId is available with these credentials. Call list_projects to see the projects you can access.';
    case 'USER_NOT_FOUND':
      return 'User not found in this project. Find the user with list_users and its search parameter (by name or identifier), or check the identifier with the user.';
    case 'FUNNEL_NOT_FOUND':
      return 'Funnel not found in this project. Use list_funnels to find valid funnel ids.';
    default:
      return error.message;
  }
}

function getPlanLimitMessage(organizationId: string | undefined, input: unknown): string {
  const earliestDate = formatApiDay(addDays(new Date(), -FREE_PLAN_RETENTION_DAYS));
  // Without a known organization, /billing opens the pricing of the user's first organization.
  const billingUrl = organizationId
    ? `${getVemetricUrl('app')}/o/${organizationId}?orgSettings=billing&pricingDialog=true`
    : `${getVemetricUrl('app')}/billing`;
  const plan = `the project's Vemetric plan (Free) only includes data from the last ${FREE_PLAN_RETENTION_DAYS} days (since ${earliestDate})`;
  const dateRange = (input as { dateRange?: PresetTimeSpan | [string, string] } | undefined)?.dateRange;
  const requested = Array.isArray(dateRange)
    ? `The requested period starts ${dateRange[0].slice(0, 10)}, but ${plan}.`
    : `The requested period${dateRange ? ` "${dateRange}"` : ''} isn't available: ${plan}.`;

  return [
    requested,
    `Tell the user that this period isn't included in their plan and that they can upgrade to the Professional plan for longer data retention: ${billingUrl}`,
    `Don't retry with other periods that start before ${earliestDate}. You can offer to answer for the last ${FREE_PLAN_RETENTION_DAYS} days instead.`,
  ].join(' ');
}

export function getRateLimitMessage(resetSec: number): string {
  return `Rate limit reached for this project (100 tool calls per minute). Try again in ${resetSec} seconds. If the user is waiting, tell them why.`;
}

export const UNEXPECTED_ERROR_MESSAGE =
  'An unexpected error occurred in Vemetric. Try again later. If it keeps failing, tell the user to contact Vemetric support.';
