import type { TotalAdjustmentsNotification, TransactionTotalsNotification } from '@paddle/paddle-node-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdjustmentRefundAmount,
  getTransactionConversionType,
  getTransactionNetAmount,
  KLIBON_CONVERSIONS_URL,
  KlibonRetryableError,
  reportKlibonConversion,
} from './klibon';

vi.mock('./backend-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const makeTotals = (overrides: Partial<TransactionTotalsNotification> = {}): TransactionTotalsNotification =>
  ({
    subtotal: '2900',
    discount: '0',
    tax: '551',
    total: '3451',
    credit: '0',
    creditToBalance: '0',
    balance: '0',
    grandTotal: '3451',
    fee: '180',
    earnings: '3271',
    currencyCode: 'USD',
    ...overrides,
  }) as TransactionTotalsNotification;

const makeAdjustmentTotals = (overrides: Partial<TotalAdjustmentsNotification> = {}): TotalAdjustmentsNotification =>
  ({
    subtotal: '-2900',
    tax: '-551',
    total: '-3451',
    fee: '0',
    earnings: '-3451',
    currencyCode: 'USD',
    ...overrides,
  }) as TotalAdjustmentsNotification;

describe('klibon conversion helpers', () => {
  describe('getTransactionNetAmount', () => {
    it('returns net amount excluding tax for standard payments', () => {
      expect(getTransactionNetAmount(makeTotals())).toBe(2900);
    });

    it('accounts for discounts and excludes tax', () => {
      expect(
        getTransactionNetAmount(
          makeTotals({
            subtotal: '2900',
            discount: '580',
            tax: '441',
            total: '2761',
            grandTotal: '2761',
          }),
        ),
      ).toBe(2320);
    });

    it('returns 0 for 100%-off coupons', () => {
      expect(
        getTransactionNetAmount(
          makeTotals({
            subtotal: '2900',
            discount: '2900',
            tax: '0',
            total: '0',
            grandTotal: '0',
          }),
        ),
      ).toBe(0);
    });

    it('subtracts applied credit and never goes negative', () => {
      expect(
        getTransactionNetAmount(
          makeTotals({
            subtotal: '4900',
            discount: '0',
            tax: '570',
            total: '5470',
            credit: '1900',
            grandTotal: '3570',
          }),
        ),
      ).toBe(3000);

      expect(
        getTransactionNetAmount(
          makeTotals({
            subtotal: '2900',
            discount: '0',
            tax: '551',
            total: '3451',
            credit: '3451',
            grandTotal: '0',
          }),
        ),
      ).toBe(0);
    });

    it('returns null for missing or malformed totals', () => {
      expect(getTransactionNetAmount(null)).toBeNull();
      expect(getTransactionNetAmount(makeTotals({ total: '29.00' }))).toBeNull();
    });
  });

  describe('getAdjustmentRefundAmount', () => {
    it('returns positive minor units from negative or positive Paddle refund subtotals', () => {
      expect(getAdjustmentRefundAmount(makeAdjustmentTotals({ subtotal: '-1900' }))).toBe(1900);
      expect(getAdjustmentRefundAmount(makeAdjustmentTotals({ subtotal: '1900' }))).toBe(1900);
    });

    it('returns null for zero, missing, or invalid refund subtotals', () => {
      expect(getAdjustmentRefundAmount(null)).toBeNull();
      expect(getAdjustmentRefundAmount(makeAdjustmentTotals({ subtotal: '0' }))).toBeNull();
      expect(getAdjustmentRefundAmount(makeAdjustmentTotals({ subtotal: 'abc' }))).toBeNull();
    });
  });

  describe('getTransactionConversionType', () => {
    it('maps Paddle transaction origins to Klibon conversion types', () => {
      expect(getTransactionConversionType('web')).toBe('sale');
      expect(getTransactionConversionType('api')).toBe('sale');
      expect(getTransactionConversionType('subscription_recurring')).toBe('renewal');
      expect(getTransactionConversionType('subscription_update')).toBe('renewal');
      expect(getTransactionConversionType('subscription_charge')).toBe('renewal');
      expect(getTransactionConversionType('subscription_payment_method_change')).toBeNull();
    });
  });
});

describe('reportKlibonConversion', () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.KLIBON_API_KEY;
    delete process.env.KLIBON_PROGRAM_ID;
    delete process.env.PADDLE_ENVIRONMENT;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it('does nothing when KLIBON_API_KEY is not configured', async () => {
    await reportKlibonConversion({
      eventId: 'txn_1',
      type: 'sale',
      amount: 2900,
      currency: 'USD',
      customerId: 'org_1',
      referralCode: 'partner_1',
      paymentId: 'txn_1',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a production sale payload without PII and with optional program_id', async () => {
    process.env.KLIBON_API_KEY = 'klb_live_123';
    process.env.KLIBON_PROGRAM_ID = 'prog_abc';
    process.env.PADDLE_ENVIRONMENT = 'production';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ received: true }), { status: 201 }));

    await reportKlibonConversion({
      eventId: 'txn_1',
      type: 'sale',
      amount: 2900,
      currency: 'USD',
      customerId: 'org_1',
      referralCode: 'partner_1',
      paymentId: 'txn_1',
      subscriptionId: 'sub_1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(KLIBON_CONVERSIONS_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer klb_live_123',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      event_id: 'txn_1',
      type: 'sale',
      amount: 2900,
      currency: 'USD',
      customer_id: 'org_1',
      payment_id: 'txn_1',
      subscription_id: 'sub_1',
      referral_code: 'partner_1',
      program_id: 'prog_abc',
    });
  });

  it('marks sandbox events with test: true and omits referral_code on refunds', async () => {
    process.env.KLIBON_API_KEY = 'klb_test_123';
    process.env.PADDLE_ENVIRONMENT = 'sandbox';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ received: true }), { status: 201 }));

    await reportKlibonConversion({
      eventId: 'adj_1',
      type: 'refund',
      amount: 1500,
      currency: 'EUR',
      customerId: 'org_1',
      referralCode: 'partner_1',
      paymentId: 'txn_1',
      subscriptionId: 'sub_1',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      event_id: 'adj_1',
      type: 'refund',
      amount: 1500,
      currency: 'EUR',
      customer_id: 'org_1',
      payment_id: 'txn_1',
      subscription_id: 'sub_1',
      test: true,
    });
  });

  it('throws KlibonRetryableError on 5xx, 429, and network failures', async () => {
    process.env.KLIBON_API_KEY = 'klb_live_123';
    const input = {
      eventId: 'txn_1',
      type: 'sale' as const,
      amount: 2900,
      currency: 'USD',
      customerId: 'org_1',
      referralCode: 'partner_1',
      paymentId: 'txn_1',
    };

    fetchMock.mockResolvedValueOnce(new Response('server error', { status: 503 }));
    await expect(reportKlibonConversion(input)).rejects.toBeInstanceOf(KlibonRetryableError);

    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    await expect(reportKlibonConversion(input)).rejects.toBeInstanceOf(KlibonRetryableError);

    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(reportKlibonConversion(input)).rejects.toBeInstanceOf(KlibonRetryableError);
  });

  it('does not throw on non-retryable 4xx responses', async () => {
    process.env.KLIBON_API_KEY = 'klb_live_123';
    fetchMock.mockResolvedValueOnce(new Response('invalid payload', { status: 422 }));

    await expect(
      reportKlibonConversion({
        eventId: 'txn_1',
        type: 'sale',
        amount: 2900,
        currency: 'USD',
        customerId: 'org_1',
        referralCode: 'partner_1',
        paymentId: 'txn_1',
      }),
    ).resolves.toBeUndefined();
  });
});
