import { getPaddleInstance } from '@paddle/paddle-js';
import type { PricingPlan } from '@/utils/pricing';

let shouldReturnToBillingSettingsAfterCheckout = false;

export const returnToBillingSettingsAfterCheckout = () => {
  shouldReturnToBillingSettingsAfterCheckout = true;
};

export const consumeReturnToBillingSettingsAfterCheckout = () => {
  const shouldReturn = shouldReturnToBillingSettingsAfterCheckout;
  shouldReturnToBillingSettingsAfterCheckout = false;
  return shouldReturn;
};

interface CheckoutProps {
  organizationId: string;
  email: string;
  pricingPlan: PricingPlan;
  isYearly: boolean;
  // the affiliate code saved on the organization or account at signup
  affiliateCode?: string | null;
}

export const openPaddleCheckout = ({ organizationId, email, pricingPlan, isYearly, affiliateCode }: CheckoutProps) => {
  getPaddleInstance()?.Checkout.open({
    customData: {
      organizationId,
      // read by Klibon to credit the sale to the affiliate (only for signups referred by a partner)
      ...(affiliateCode ? { klibon: affiliateCode } : {}),
    },
    customer: {
      email,
    },
    items: [
      {
        priceId: isYearly ? pricingPlan.yearlyId : pricingPlan.monthlyId,
        quantity: 1,
      },
    ],
  });
};
