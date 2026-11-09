import type { PresetTimeSpan } from '@vemetric/common/charts/timespans';
import { getVemetricUrl } from '@vemetric/common/env';
import { addDays } from 'date-fns';
import { ApiError, type ApiErrorCode } from '../api/utils/errors';
import { FREE_PLAN_RETENTION_DAYS } from '../utils/retention';

type ToolErrorContext = {
  organizationId: string;
  input: unknown;
};

/** Error messages that tell the model what went wrong and how to recover, instead of retrying blindly. */
export function getToolErrorMessage(error: ApiError, { organizationId, input }: ToolErrorContext): string {
  switch (error.code) {
    case 'PLAN_LIMIT_EXCEEDED':
      return getPlanLimitMessage(organizationId, input);
    case 'PROJECT_REQUIRED':
      return `${error.message} Call list_projects to see the projects you can access, then pass the projectId of the one the user means. Ask the user if it's unclear which project they mean.`;
    case 'PROJECT_NOT_FOUND':
      return 'No project with this projectId is available with these credentials. Call list_projects to see the projects you can access.';
    case 'USER_NOT_FOUND':
      return 'User not found in this project. Use list_users to find valid user ids, or check the identifier with the user.';
    case 'FUNNEL_NOT_FOUND':
      return 'Funnel not found in this project. Use list_funnels to find valid funnel ids.';
    default:
      return error.message;
  }
}

function getPlanLimitMessage(organizationId: string, input: unknown): string {
  const earliestDate = formatDate(addDays(new Date(), -FREE_PLAN_RETENTION_DAYS));
  const billingUrl = `${getVemetricUrl('app')}/o/${organizationId}?orgSettings=billing&pricingDialog=true`;
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

export function getErrorCode(error: unknown): ApiErrorCode {
  return error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
