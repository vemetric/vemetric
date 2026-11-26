import type { BillingInfo, Organization } from 'database';

// Subscriptions granted by hand (e.g. for our own organization) don't exist in Paddle.
// Their billing info stores this placeholder instead of real Paddle IDs.
export const MANUAL_SUBSCRIPTION_ID = '1';

/**
 * Only call the Paddle API when this returns true, Paddle rejects the placeholder IDs of manual subscriptions.
 */
export const isPaddleSubscription = (billingInfo: BillingInfo | null | undefined): billingInfo is BillingInfo =>
  Boolean(billingInfo && billingInfo.subscriptionId !== MANUAL_SUBSCRIPTION_ID);

export const getSubscriptionStatus = async (organization: Organization & { billingInfo: BillingInfo | null }) => {
  const billingInfo = organization.billingInfo;

  return {
    isActive: billingInfo?.subscriptionStatus === 'active' || billingInfo?.subscriptionStatus === 'past_due',
    isPastDue: billingInfo?.subscriptionStatus === 'past_due',
    priceId: billingInfo?.priceId,
    customPlanEvents: organization.customPlanEvents,
  };
};

export type SubscriptionStatus = Awaited<ReturnType<typeof getSubscriptionStatus>>;
