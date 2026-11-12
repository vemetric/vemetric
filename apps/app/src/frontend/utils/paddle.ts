import { getPaddleInstance } from '@paddle/paddle-js';
import { getAffiliateCodeFromCookie } from '@/utils/affiliate';
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
  // the affiliate code saved on the account at signup
  affiliateCode?: string | null;
}

export const openPaddleCheckout = ({ organizationId, email, pricingPlan, isYearly, affiliateCode }: CheckoutProps) => {
  getPaddleInstance()?.Checkout.open({
    customData: {
      organizationId,
      // read by Klibon to credit the sale to the affiliate (empty when the customer wasn't referred)
      klibon: affiliateCode ?? getAffiliateCodeFromCookie() ?? '',
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
