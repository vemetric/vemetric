import type { BillingInfo } from 'database';
import { describe, expect, it } from 'vitest';
import { isPaddleSubscription } from './billing';

const billingInfo = (overrides: Partial<BillingInfo>) =>
  ({
    subscriptionId: 'sub_01h8bx4ndb8yhjm4b3p0b9ykcn',
    customerId: 'ctm_01h8441jn5pcwrfhwh78jqt8hk',
    ...overrides,
  }) as BillingInfo;

describe('isPaddleSubscription', () => {
  it('accepts billing info with Paddle subscription and customer IDs', () => {
    expect(isPaddleSubscription(billingInfo({}))).toBe(true);
  });

  it('rejects missing billing info', () => {
    expect(isPaddleSubscription(null)).toBe(false);
    expect(isPaddleSubscription(undefined)).toBe(false);
  });

  it('rejects manually granted subscriptions with placeholder IDs', () => {
    // This is what our manually granted subscriptions store
    expect(isPaddleSubscription(billingInfo({ subscriptionId: '1', customerId: '1' }))).toBe(false);
    expect(isPaddleSubscription(billingInfo({ subscriptionId: '' }))).toBe(false);
    expect(isPaddleSubscription(billingInfo({ subscriptionId: 'manual' }))).toBe(false);
    expect(isPaddleSubscription(billingInfo({ subscriptionId: 'sub_fake' }))).toBe(false);
    expect(isPaddleSubscription(billingInfo({ customerId: 'fake-customer' }))).toBe(false);
  });
});
