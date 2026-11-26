import type { BillingInfo, Organization } from 'database';

// Paddle IDs are a prefix plus 26 lowercase alphanumeric characters (e.g. sub_01h8bx4ndb8yhjm4b3p0b9ykcn).
const PADDLE_SUBSCRIPTION_ID_REGEX = /^sub_[a-z\d]{26}$/;
const PADDLE_CUSTOMER_ID_REGEX = /^ctm_[a-z\d]{26}$/;

export type PaddleBillingInfo = BillingInfo & { subscriptionId: string; customerId: string };

/**
 * Subscriptions can also be granted by hand (e.g. for our own organization), in which case the billing info
 * holds placeholder IDs (currently "1") that Paddle rejects. Only call the Paddle API when this returns true.
 */
export const isPaddleSubscription = (billingInfo: BillingInfo | null | undefined): billingInfo is PaddleBillingInfo =>
  Boolean(
    billingInfo &&
    PADDLE_SUBSCRIPTION_ID_REGEX.test(billingInfo.subscriptionId) &&
    PADDLE_CUSTOMER_ID_REGEX.test(billingInfo.customerId),
  );

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
