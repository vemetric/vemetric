import { EventName } from '@paddle/paddle-node-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paddleWebhookHandler } from './paddle';
import type { HonoContext } from '../types';
import { KlibonRetryableError } from '../utils/klibon';
import type * as KlibonModule from '../utils/klibon';

const {
  unmarshalMock,
  getTransactionMock,
  findOrgByIdMock,
  findBySubscriptionIdMock,
  findByTransactionIdMock,
  reportKlibonConversionMock,
} = vi.hoisted(() => ({
  unmarshalMock: vi.fn(),
  getTransactionMock: vi.fn(),
  findOrgByIdMock: vi.fn(),
  findBySubscriptionIdMock: vi.fn(),
  findByTransactionIdMock: vi.fn(),
  reportKlibonConversionMock: vi.fn(),
}));

vi.mock('@vemetric/common/request-ip', () => ({
  getClientIp: () => '34.232.58.13',
}));

vi.mock('@vemetric/email/transactional', () => ({
  sendTransactionalMail: vi.fn(),
}));

vi.mock('../utils/backend-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../utils/paddle', () => ({
  paddleApi: {
    webhooks: { unmarshal: unmarshalMock },
    transactions: { get: getTransactionMock },
  },
}));

vi.mock('../utils/vemetric-client', () => ({
  vemetric: { trackEvent: vi.fn() },
}));

vi.mock('database', () => ({
  dbOrganization: {
    findById: findOrgByIdMock,
    update: vi.fn(),
    getOrganizationUsersWithDetails: vi.fn(),
  },
  dbBillingInfo: {
    upsert: vi.fn(),
    findBySubscriptionId: findBySubscriptionIdMock,
    findByTransactionId: findByTransactionIdMock,
  },
}));

vi.mock('../utils/klibon', async (importOriginal) => {
  const actual = await importOriginal<typeof KlibonModule>();
  return {
    ...actual,
    reportKlibonConversion: reportKlibonConversionMock,
  };
});

const createContext = () => {
  const textMock = vi.fn((body: string, status: number) => ({ body, status }));
  const context = {
    req: {
      header: (name: string) => (name === 'paddle-signature' ? 'ts=1;h1=sig' : undefined),
      text: async () => '{"event":"raw"}',
    },
    text: textMock,
  } as unknown as HonoContext;
  return { context, textMock };
};

describe('paddleWebhookHandler Klibon reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOrgByIdMock.mockResolvedValue({ id: 'org_1', affiliateCode: 'partner_1' });
    findBySubscriptionIdMock.mockResolvedValue(null);
    findByTransactionIdMock.mockResolvedValue(null);
    reportKlibonConversionMock.mockResolvedValue(undefined);
  });

  it('reports a sale conversion for a referred organization on transaction.completed', async () => {
    unmarshalMock.mockResolvedValue({
      eventType: EventName.TransactionCompleted,
      data: {
        id: 'txn_123',
        origin: 'web',
        currencyCode: 'USD',
        subscriptionId: 'sub_123',
        customData: { organizationId: 'org_1' },
        details: {
          totals: {
            subtotal: '2900',
            discount: '0',
            tax: '551',
            total: '3451',
            credit: '0',
            grandTotal: '3451',
            currencyCode: 'USD',
          },
        },
      },
    });

    const { context, textMock } = createContext();
    await paddleWebhookHandler(context);

    expect(textMock).toHaveBeenCalledWith('', 200);
    expect(reportKlibonConversionMock).toHaveBeenCalledWith({
      eventId: 'txn_123',
      type: 'sale',
      amount: 2900,
      currency: 'USD',
      customerId: 'org_1',
      referralCode: 'partner_1',
      paymentId: 'txn_123',
      subscriptionId: 'sub_123',
    });
  });

  it('reports a renewal for recurring subscription transactions', async () => {
    unmarshalMock.mockResolvedValue({
      eventType: EventName.TransactionCompleted,
      data: {
        id: 'txn_456',
        origin: 'subscription_recurring',
        currencyCode: 'EUR',
        subscriptionId: 'sub_123',
        customData: null,
        details: {
          totals: {
            subtotal: '4900',
            discount: '0',
            tax: '931',
            total: '5831',
            credit: '0',
            grandTotal: '5831',
            currencyCode: 'EUR',
          },
        },
      },
    });
    findBySubscriptionIdMock.mockResolvedValue({ organizationId: 'org_1' });

    const { context, textMock } = createContext();
    await paddleWebhookHandler(context);

    expect(textMock).toHaveBeenCalledWith('', 200);
    expect(reportKlibonConversionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'txn_456',
        type: 'renewal',
        amount: 4900,
        currency: 'EUR',
        customerId: 'org_1',
        referralCode: 'partner_1',
      }),
    );
  });

  it('never sends data to Klibon for non-referred organizations', async () => {
    findOrgByIdMock.mockResolvedValue({ id: 'org_organic', affiliateCode: null });
    unmarshalMock.mockResolvedValue({
      eventType: EventName.TransactionCompleted,
      data: {
        id: 'txn_organic',
        origin: 'web',
        currencyCode: 'USD',
        subscriptionId: 'sub_organic',
        customData: { organizationId: 'org_organic' },
        details: {
          totals: {
            subtotal: '2900',
            discount: '0',
            tax: '0',
            total: '2900',
            credit: '0',
            grandTotal: '2900',
            currencyCode: 'USD',
          },
        },
      },
    });

    const { context, textMock } = createContext();
    await paddleWebhookHandler(context);

    expect(textMock).toHaveBeenCalledWith('', 200);
    expect(reportKlibonConversionMock).not.toHaveBeenCalled();
  });

  it('skips payment method change transactions', async () => {
    unmarshalMock.mockResolvedValue({
      eventType: EventName.TransactionCompleted,
      data: {
        id: 'txn_pm',
        origin: 'subscription_payment_method_change',
        currencyCode: 'USD',
        subscriptionId: 'sub_123',
        customData: { organizationId: 'org_1' },
        details: { totals: null },
      },
    });

    const { context, textMock } = createContext();
    await paddleWebhookHandler(context);

    expect(textMock).toHaveBeenCalledWith('', 200);
    expect(reportKlibonConversionMock).not.toHaveBeenCalled();
  });

  it('returns 500 when Klibon fails with a retryable error so Paddle retries', async () => {
    reportKlibonConversionMock.mockRejectedValue(new KlibonRetryableError('503'));
    unmarshalMock.mockResolvedValue({
      eventType: EventName.TransactionCompleted,
      data: {
        id: 'txn_retry',
        origin: 'web',
        currencyCode: 'USD',
        subscriptionId: 'sub_123',
        customData: { organizationId: 'org_1' },
        details: {
          totals: {
            subtotal: '2900',
            discount: '0',
            tax: '0',
            total: '2900',
            credit: '0',
            grandTotal: '2900',
            currencyCode: 'USD',
          },
        },
      },
    });

    const { context, textMock } = createContext();
    await paddleWebhookHandler(context);

    expect(textMock).toHaveBeenCalledWith('', 500);
  });

  it('reports approved refunds on adjustment.updated using billingInfo lookup', async () => {
    findBySubscriptionIdMock.mockResolvedValue({ organizationId: 'org_1' });
    unmarshalMock.mockResolvedValue({
      eventType: EventName.AdjustmentUpdated,
      data: {
        id: 'adj_1',
        action: 'refund',
        status: 'approved',
        transactionId: 'txn_123',
        subscriptionId: 'sub_123',
        currencyCode: 'USD',
        totals: {
          subtotal: '-2900',
          tax: '-551',
          total: '-3451',
          fee: '0',
          earnings: '-3451',
          currencyCode: 'USD',
        },
      },
    });

    const { context, textMock } = createContext();
    await paddleWebhookHandler(context);

    expect(textMock).toHaveBeenCalledWith('', 200);
    expect(reportKlibonConversionMock).toHaveBeenCalledWith({
      eventId: 'adj_1',
      type: 'refund',
      amount: 2900,
      currency: 'USD',
      customerId: 'org_1',
      paymentId: 'txn_123',
      subscriptionId: 'sub_123',
    });
  });

  it('falls back to Paddle transaction lookup when an adjustment is not matched in billingInfo', async () => {
    getTransactionMock.mockResolvedValue({ customData: { organizationId: 'org_1' } });
    unmarshalMock.mockResolvedValue({
      eventType: EventName.AdjustmentUpdated,
      data: {
        id: 'adj_2',
        action: 'chargeback',
        status: 'approved',
        transactionId: 'txn_old',
        subscriptionId: 'sub_old',
        currencyCode: 'USD',
        totals: {
          subtotal: '-1500',
          tax: '0',
          total: '-1500',
          fee: '0',
          earnings: '-1500',
          currencyCode: 'USD',
        },
      },
    });

    const { context, textMock } = createContext();
    await paddleWebhookHandler(context);

    expect(textMock).toHaveBeenCalledWith('', 200);
    expect(getTransactionMock).toHaveBeenCalledWith('txn_old');
    expect(reportKlibonConversionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'adj_2',
        type: 'refund',
        amount: 1500,
        paymentId: 'txn_old',
      }),
    );
  });

  it('ignores pending or non-refund adjustments', async () => {
    unmarshalMock.mockResolvedValue({
      eventType: EventName.AdjustmentUpdated,
      data: {
        id: 'adj_pending',
        action: 'refund',
        status: 'pending_approval',
        transactionId: 'txn_123',
        subscriptionId: 'sub_123',
        currencyCode: 'USD',
        totals: { subtotal: '-2900', currencyCode: 'USD' },
      },
    });

    const { context, textMock } = createContext();
    await paddleWebhookHandler(context);

    expect(textMock).toHaveBeenCalledWith('', 200);
    expect(reportKlibonConversionMock).not.toHaveBeenCalled();
  });
});
