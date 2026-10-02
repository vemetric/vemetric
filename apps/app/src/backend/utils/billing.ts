import { isSelfHosted } from '@vemetric/common/self-hosted';
import type { BillingInfo, Organization } from 'database';

/**
 * Event allowance reported for self hosted instances.
 *
 * `priceId` stays undefined there because no Paddle price backs the instance, and the
 * frontend derives its allowance as `customPlanEvents ?? plan?.events ?? FREE_PLAN_EVENTS`.
 * Without an explicit allowance an unknown price therefore lands on the free plan's 2500
 * events, which is the smallest limit of all. Reporting an allowance that cannot be reached
 * keeps a self hosted instance on the unlimited side of every such comparison.
 */
const SELF_HOSTED_EVENTS_INCLUDED = Number.MAX_SAFE_INTEGER;

/**
 * Resolves the effective subscription state of an organization.
 * @param organization Organization together with its billing info.
 * @returns Subscription state used for feature gating and usage display.
 */
export const getSubscriptionStatus = async (organization: Organization & { billingInfo: BillingInfo | null }) => {
  // Self hosted instances have no billing at all, so they always behave like an
  // active subscription on the highest plan. This is what removes time span
  // restrictions, retention limits, and the member/project limits further down,
  // since all of those checks are gated on isActive.
  if (isSelfHosted()) {
    return {
      isActive: true,
      isPastDue: false,
      priceId: undefined,
      customPlanEvents: organization.customPlanEvents ?? SELF_HOSTED_EVENTS_INCLUDED,
    };
  }

  const billingInfo = organization.billingInfo;

  return {
    isActive: billingInfo?.subscriptionStatus === 'active' || billingInfo?.subscriptionStatus === 'past_due',
    isPastDue: billingInfo?.subscriptionStatus === 'past_due',
    priceId: billingInfo?.priceId,
    customPlanEvents: organization.customPlanEvents,
  };
};

export type SubscriptionStatus = Awaited<ReturnType<typeof getSubscriptionStatus>>;
