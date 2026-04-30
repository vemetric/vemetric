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
}

export const openPaddleCheckout = ({ organizationId, email, pricingPlan, isYearly }: CheckoutProps) => {
  getPaddleInstance()?.Checkout.open({
    customData: {
      organizationId,
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
