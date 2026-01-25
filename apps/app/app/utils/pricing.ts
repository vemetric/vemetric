import type { UsageStats } from '@vemetric/common/usage';

export const FREE_PLAN_EVENTS = 2500;

interface SubscriptionStatus {
  isActive: boolean;
  isPastDue: boolean;
  priceId?: string;
  customPlanEvents?: number | null;
  usageCycles?: UsageStats[];
}

export interface UsageCycle {
  usage: UsageStats;
  type: 'current' | 'previous' | 'past';
  exceeded: boolean;
}

const hasMultipleExceeded = (usageCycles: UsageStats[], eventsIncluded: number): boolean => {
  let exceededCount = 0;
  for (const usageCycle of usageCycles) {
    if (usageCycle.total > eventsIncluded) {
      exceededCount++;
    }
  }
  return exceededCount >= 2;
};

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

  const eventsIncluded = subscriptionStatus?.customPlanEvents ?? pricingPlan?.events ?? FREE_PLAN_EVENTS;

  const usageCycles = subscriptionStatus?.usageCycles ?? [];

  // Index 0 is current cycle
  const currentCycleUsage = usageCycles[0];
  const exceededInCurrentCycle = currentCycleUsage ? currentCycleUsage.total > eventsIncluded : false;
  const hasMultipleExceededCycles = hasMultipleExceeded(usageCycles, eventsIncluded);

  // Show warning if: current OR multiple cycles exceeded
  const showLimitWarning = exceededInCurrentCycle || hasMultipleExceededCycles;

  // Build cycles with computed flags for components
  const cycles: UsageCycle[] = usageCycles.map((usage, index) => ({
    usage,
    type: index === 0 ? 'current' : index === 1 ? 'previous' : 'past',
    exceeded: usage.total > eventsIncluded,
  }));

  return {
    isYearly,
    pricingPlanIndex,
    eventsIncluded,
    price: pricingPlan?.price ?? 0,
    cycles,
    hasMultipleExceededCycles: hasMultipleExceededCycles,
    showLimitWarning,
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
