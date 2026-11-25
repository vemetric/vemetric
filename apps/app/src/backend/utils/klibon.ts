import type {
  TotalAdjustmentsNotification,
  TransactionOrigin,
  TransactionTotalsNotification,
} from '@paddle/paddle-node-sdk';
import { logger } from './backend-logger';

export const KLIBON_CONVERSIONS_URL = 'https://klibon.com/api/v1/conversions';

const REQUEST_TIMEOUT_MS = 10_000;

export type KlibonConversionType = 'sale' | 'renewal' | 'refund';

export interface KlibonConversionInput {
  eventId: string;
  type: KlibonConversionType;
  /** Net minor-unit amount after discounts, excluding tax, before processor fees (non-negative integer). */
  amount: number;
  currency: string;
  /** Opaque internal customer identifier (organizationId) so no PII/email is sent to Klibon. */
  customerId: string;
  /** Affiliate code saved on the organization. Sent on sales/renewals; omitted on refunds. */
  referralCode?: string;
  /** Paddle transaction ID; required by Klibon on refunds to reverse the matching commission. */
  paymentId: string;
  subscriptionId?: string | null;
}

export class KlibonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KlibonRetryableError';
  }
}

const parseMinorUnits = (value: string | null | undefined): number | null => {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

/**
 * Computes the net minor-unit amount paid by the customer after discounts and credits, excluding tax.
 */
export const getTransactionNetAmount = (totals: TransactionTotalsNotification | null | undefined): number | null => {
  if (!totals) {
    return null;
  }

  const total = parseMinorUnits(totals.total);
  const tax = parseMinorUnits(totals.tax);
  const credit = parseMinorUnits(totals.credit);
  const grandTotal = parseMinorUnits(totals.grandTotal);

  if (total === null || tax === null || credit === null || grandTotal === null) {
    return null;
  }

  return Math.max(0, Math.min(grandTotal, total - tax - credit));
};

/**
 * Computes the positive minor-unit refund amount excluding tax from a Paddle adjustment.
 * Returns null if the subtotal is invalid or zero.
 */
export const getAdjustmentRefundAmount = (totals: TotalAdjustmentsNotification | null | undefined): number | null => {
  if (!totals) {
    return null;
  }

  const subtotal = parseMinorUnits(totals.subtotal);
  if (subtotal === null) {
    return null;
  }

  const amount = Math.abs(subtotal);
  return amount > 0 ? amount : null;
};

/**
 * Maps a Paddle transaction origin to a Klibon conversion type.
 * Returns null for non-revenue transactions like payment method updates.
 */
export const getTransactionConversionType = (origin: TransactionOrigin): 'sale' | 'renewal' | null => {
  switch (origin) {
    case 'subscription_recurring':
    case 'subscription_update':
    case 'subscription_charge':
      return 'renewal';
    case 'web':
    case 'api':
      return 'sale';
    case 'subscription_payment_method_change':
      return null;
  }
};

export const reportKlibonConversion = async (input: KlibonConversionInput): Promise<void> => {
  const apiKey = process.env.KLIBON_API_KEY?.trim();
  if (!apiKey) {
    return;
  }

  const programId = process.env.KLIBON_PROGRAM_ID?.trim();
  const isTest = (process.env.PADDLE_ENVIRONMENT ?? 'sandbox') !== 'production';

  const body: Record<string, unknown> = {
    event_id: input.eventId,
    type: input.type,
    amount: input.amount,
    currency: input.currency,
    customer_id: input.customerId,
    payment_id: input.paymentId,
    ...(input.subscriptionId ? { subscription_id: input.subscriptionId } : {}),
    ...(input.type !== 'refund' && input.referralCode ? { referral_code: input.referralCode } : {}),
    ...(programId ? { program_id: programId } : {}),
    ...(isTest ? { test: true } : {}),
  };

  let response: Response;
  try {
    response = await fetch(KLIBON_CONVERSIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.error(
      { err, eventId: input.eventId, type: input.type, organizationId: input.customerId },
      'Klibon: conversion request failed',
    );
    throw new KlibonRetryableError('Klibon conversion request failed');
  }

  if (response.ok) {
    logger.info(
      {
        eventId: input.eventId,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        organizationId: input.customerId,
      },
      'Klibon: conversion reported',
    );
    return;
  }

  const responseText = await response.text().catch(() => '');
  logger.error(
    {
      status: response.status,
      responseBody: responseText,
      eventId: input.eventId,
      type: input.type,
      organizationId: input.customerId,
    },
    'Klibon: conversion API returned an error',
  );

  // Ask Paddle to retry on rate limits and server errors; 4xx errors won't succeed on retry.
  if (response.status === 429 || response.status >= 500) {
    throw new KlibonRetryableError(`Klibon API responded with status ${response.status}`);
  }
};
