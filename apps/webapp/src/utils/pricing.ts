export const FREE_PLAN_EVENTS = 2500;

interface SubscriptionStatus {
  isActive: boolean;
  isPastDue: boolean;
  priceId?: string;
  customPlanEvents?: number | null;
}

export const getPricingPlan = (subscriptionStatus?: SubscriptionStatus) => {
  let isYearly = false;
  let pricingPlanIndex = 0;

  const pricingPlan = subscriptionStatus?.isActive
    ? PRICING_PLANS.find((plan, index) => {
        if (plan.monthlyId === subscriptionStatus.priceId) {
          isYearly = false;
          pricingPlanIndex = index;
          return plan;
        }

        if (plan.yearlyId === subscriptionStatus.priceId) {
          isYearly = true;
          pricingPlanIndex = index;
          return plan;
        }

        return null;
      })
    : null;

  // If there's a custom plan override from the database, use it
  if (subscriptionStatus?.customPlanEvents) {
    return {
      isYearly,
      pricingPlanIndex,
      eventsIncluded: subscriptionStatus.customPlanEvents,
      price: pricingPlan?.price ?? 0,
    };
  }

  return {
    isYearly,
    pricingPlanIndex,
    eventsIncluded: pricingPlan?.events ?? FREE_PLAN_EVENTS,
    price: pricingPlan?.price ?? 0,
  };
};

export interface PricingPlan {
  monthlyId: string;
  yearlyId: string;
  events: number;
  price: number;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    monthlyId: import.meta.env.VITE_PADDLE_10K_MONTHLY || 'pri_01jq8whn80qb6ndehv6e7swx1q',
    yearlyId: import.meta.env.VITE_PADDLE_10K_YEARLY || 'pri_01jq8wj6y3aazymteg9fphg6ek',
    events: 10000,
    price: 5,
  },
  {
    monthlyId: import.meta.env.VITE_PADDLE_100K_MONTHLY || 'pri_01jq8wm198t92vzsy36zxjmv2b',
    yearlyId: import.meta.env.VITE_PADDLE_100K_YEARLY || 'pri_01jq8wmfd44z3pe6kesjyk32kj',
    events: 100000,
    price: 15,
  },
  {
    monthlyId: import.meta.env.VITE_PADDLE_250K_MONTHLY || 'pri_01jq8whn80qb6ndehv6e7swx1q',
    yearlyId: import.meta.env.VITE_PADDLE_250K_YEARLY || 'pri_01jq8wj6y3aazymteg9fphg6ek',
    events: 250000,
    price: 25,
  },
  {
    monthlyId: import.meta.env.VITE_PADDLE_500K_MONTHLY || 'pri_01jq8whn80qb6ndehv6e7swx1q',
    yearlyId: import.meta.env.VITE_PADDLE_500K_YEARLY || 'pri_01jq8wj6y3aazymteg9fphg6ek',
    events: 500000,
    price: 40,
  },
  {
    monthlyId: import.meta.env.VITE_PADDLE_1M_MONTHLY || 'pri_01jq8whn80qb6ndehv6e7swx1q',
    yearlyId: import.meta.env.VITE_PADDLE_1M_YEARLY || 'pri_01jq8wj6y3aazymteg9fphg6ek',
    events: 1000000,
    price: 80,
  },
  {
    monthlyId: import.meta.env.VITE_PADDLE_2M_MONTHLY || 'pri_01jq8whn80qb6ndehv6e7swx1q',
    yearlyId: import.meta.env.VITE_PADDLE_2M_YEARLY || 'pri_01jq8wj6y3aazymteg9fphg6ek',
    events: 2500000,
    price: 160,
  },
  {
    monthlyId: import.meta.env.VITE_PADDLE_5M_MONTHLY || 'pri_01jq8whn80qb6ndehv6e7swx1q',
    yearlyId: import.meta.env.VITE_PADDLE_5M_YEARLY || 'pri_01jq8wj6y3aazymteg9fphg6ek',
    events: 5000000,
    price: 230,
  },
  {
    monthlyId: '',
    yearlyId: '',
    events: 5000000,
    price: -1,
  },
];
