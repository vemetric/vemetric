import type { BillingInfo } from 'database';
import { describe, expect, it } from 'vitest';
import { isPaddleSubscription, MANUAL_SUBSCRIPTION_ID } from './billing';

const billingInfo = (overrides: Partial<BillingInfo>) =>
  ({
    subscriptionId: 'sub_01h8bx4ndb8yhjm4b3p0b9ykcn',
    customerId: 'ctm_01h8441jn5pcwrfhwh78jqt8hk',
    ...overrides,
  }) as BillingInfo;

describe('isPaddleSubscription', () => {
  it('accepts billing info from Paddle', () => {
    expect(isPaddleSubscription(billingInfo({}))).toBe(true);
  });

  it('rejects missing billing info', () => {
    expect(isPaddleSubscription(null)).toBe(false);
    expect(isPaddleSubscription(undefined)).toBe(false);
  });

  it('rejects manually granted subscriptions', () => {
    expect(
      isPaddleSubscription(billingInfo({ subscriptionId: MANUAL_SUBSCRIPTION_ID, customerId: MANUAL_SUBSCRIPTION_ID })),
    ).toBe(false);
  });
});
