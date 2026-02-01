import type { BillingInfo, Organization } from 'database';

export const getSubscriptionStatus = async (organization: Organization & { billingInfo: BillingInfo | null }) => {
  const billingInfo = organization.billingInfo;

  return {
    isActive: billingInfo?.subscriptionStatus === 'active' || billingInfo?.subscriptionStatus === 'past_due',
    isPastDue: billingInfo?.subscriptionStatus === 'past_due',
    priceId: billingInfo?.priceId,
    customPlanEvents: organization.customPlanEvents,
  };
};
