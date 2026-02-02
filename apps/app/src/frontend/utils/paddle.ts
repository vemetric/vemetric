import { getPaddleInstance } from '@paddle/paddle-js';
import type { PricingPlan } from '@/utils/pricing';

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
