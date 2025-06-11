import type { BillingInfo } from 'database';

export const getSubscriptionStatus = async (billingInfo: BillingInfo | null) => {
  return {
    isActive: billingInfo?.subscriptionStatus === 'active' || billingInfo?.subscriptionStatus === 'past_due',
    isPastDue: billingInfo?.subscriptionStatus === 'past_due',
    priceId: billingInfo?.priceId,
  };
};
