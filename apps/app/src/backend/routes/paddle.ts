import type { AdjustmentNotification, EventEntity, TransactionNotification } from '@paddle/paddle-node-sdk';
import { EventName } from '@paddle/paddle-node-sdk';
import { getClientIp } from '@vemetric/common/request-ip';
import { sendTransactionalMail, type TemplateData, type TemplateName } from '@vemetric/email/transactional';
import type { BillingInfo } from 'database';
import { dbBillingInfo, dbOrganization } from 'database';
import type { HonoContext } from '../types';
import { logger } from '../utils/backend-logger';
import {
  getAdjustmentRefundAmount,
  getTransactionConversionType,
  getTransactionNetAmount,
  KlibonRetryableError,
  reportKlibonConversion,
} from '../utils/klibon';
import { paddleApi } from '../utils/paddle';
import { vemetric } from '../utils/vemetric-client';

const secretKey = process.env.PADDLE_WEBHOOK_SECRET_KEY || '';

const allowedIpAdresses = [
  // Sandbox
  '34.194.127.46',
  '54.234.237.108',
  '3.208.120.145',
  '44.226.236.210',
  '44.241.183.62',
  '100.20.172.113',
  // Production
  '34.232.58.13',
  '34.195.105.136',
  '34.237.3.244',
  '35.155.119.135',
  '52.11.166.252',
  '34.212.5.7',
];

const sendPaddleTransactionalMail = async <T extends TemplateName>(
  toAddress: string,
  templateData: TemplateData<T>,
) => {
  try {
    const result = await sendTransactionalMail(toAddress, templateData);
    if (!result.success) {
      logger.error(
        {
          response: result.response,
          template: templateData.template,
          toAddress,
        },
        'Paddle: transactional mail failed',
      );
    }
  } catch (err) {
    logger.error(
      {
        err,
        template: templateData.template,
        toAddress,
      },
      'Paddle: transactional mail threw an error',
    );
  }
};

export async function validateWebhook(context: HonoContext): Promise<EventEntity | null> {
  const { req } = context;

  const ip = getClientIp(context);
  if (!ip || !allowedIpAdresses.includes(ip)) {
    logger.error({ ip }, 'No valid paddle ip address');
    return null;
  }

  const signature = (req.header('paddle-signature') as string) || '';
  const rawRequestBody = await req.text();

  try {
    if (signature && rawRequestBody) {
      // The `unmarshal` function will validate the integrity of the webhook and return an entity
      return await paddleApi.webhooks.unmarshal(rawRequestBody, secretKey, signature);
    } else {
      logger.error('Paddle Signature missing in header');
      return null;
    }
  } catch (err) {
    // Handle signature mismatch or other runtime errors
    logger.error({ err }, 'Error validating paddle webhook');
    return null;
  }
}

const getOrganizationIdFromCustomData = (customData: unknown): string | null => {
  if (!customData || typeof customData !== 'object') {
    return null;
  }
  const organizationId = (customData as { organizationId?: unknown }).organizationId;
  return typeof organizationId === 'string' && organizationId.length > 0 ? organizationId : null;
};

const resolveOrganizationIdForTransaction = async (transaction: TransactionNotification): Promise<string | null> => {
  const fromCustomData = getOrganizationIdFromCustomData(transaction.customData);
  if (fromCustomData) {
    return fromCustomData;
  }
  if (transaction.subscriptionId) {
    const billingInfo = await dbBillingInfo.findBySubscriptionId(transaction.subscriptionId);
    if (billingInfo) {
      return billingInfo.organizationId;
    }
  }
  return null;
};

const resolveOrganizationIdForAdjustment = async (adjustment: AdjustmentNotification): Promise<string | null> => {
  if (adjustment.subscriptionId) {
    const billingInfo = await dbBillingInfo.findBySubscriptionId(adjustment.subscriptionId);
    if (billingInfo) {
      return billingInfo.organizationId;
    }
  }

  const byTransaction = await dbBillingInfo.findByTransactionId(adjustment.transactionId);
  if (byTransaction) {
    return byTransaction.organizationId;
  }

  try {
    const transaction = await paddleApi.transactions.get(adjustment.transactionId);
    return getOrganizationIdFromCustomData(transaction.customData);
  } catch (err) {
    logger.warn(
      { err, adjustmentId: adjustment.id, transactionId: adjustment.transactionId },
      'Paddle: failed to resolve organizationId for adjustment',
    );
    return null;
  }
};

export const paddleWebhookHandler = async (context: HonoContext) => {
  const entity = await validateWebhook(context);
  if (!entity) {
    return context.text('', 400);
  }

  switch (entity.eventType) {
    case EventName.SubscriptionCreated: {
      const organizationId = getOrganizationIdFromCustomData(entity.data.customData);
      if (!organizationId) {
        logger.error({ entity }, 'Paddle: no organizationId found in custom data');
        return context.text('', 400);
      }

      const productId = entity.data.items[0].product?.id;
      if (!productId) {
        logger.error({ entity }, 'Paddle: no productId found in subscription created event');
        return context.text('', 400);
      }

      const priceId = entity.data.items[0].price?.id;
      if (!priceId) {
        logger.error({ entity }, 'Paddle: no priceId found in subscription created event');
        return context.text('', 400);
      }

      const billingInfo: Omit<BillingInfo, 'createdAt'> = {
        organizationId,
        customerId: entity.data.customerId,
        addressId: entity.data.addressId,
        businessId: entity.data.businessId,
        transactionId: entity.data.transactionId,
        subscriptionId: entity.data.id,
        subscriptionStatus: entity.data.status,
        subscriptionNextBilledAt: entity.data.nextBilledAt ? new Date(entity.data.nextBilledAt) : null,
        productId,
        priceId,
        subscriptionEndDate: null,
      };

      await dbOrganization.update(organizationId, {
        pricingOnboarded: true,
      });

      await dbBillingInfo.upsert({ ...billingInfo, createdAt: new Date() });

      const organization = await dbOrganization.findById(organizationId);
      const orgUser = (await dbOrganization.getOrganizationUsersWithDetails(organizationId))[0];
      if (orgUser) {
        await vemetric.trackEvent('SubscriptionCreated', {
          userIdentifier: orgUser.userId,
          userData: {
            set: {
              isPaid: true,
              productId,
            },
          },
          eventData: {
            pricingOnboarded: organization?.pricingOnboarded ?? false,
          },
        });

        await sendPaddleTransactionalMail(orgUser.user.email, {
          template: 'subscriptionCreated',
          props: {
            userName: orgUser.user.name,
          },
        });
      }
      break;
    }
    case EventName.SubscriptionUpdated: {
      const organizationId = getOrganizationIdFromCustomData(entity.data.customData);
      if (!organizationId) {
        logger.error({ entity }, 'Paddle: no organizationId found in custom data');
        return context.text('', 400);
      }

      const scheduledChange = entity.data.scheduledChange;

      const productId = entity.data.items[0].product?.id;
      if (!productId) {
        logger.error({ entity }, 'Paddle: no productId found in subscription updated event');
        return context.text('', 400);
      }

      const priceId = entity.data.items[0].price?.id;
      if (!priceId) {
        logger.error({ entity }, 'Paddle: no priceId found in subscription updated event');
        return context.text('', 400);
      }

      await dbBillingInfo.upsert({
        organizationId,
        customerId: entity.data.customerId,
        addressId: entity.data.addressId,
        businessId: entity.data.businessId,
        subscriptionId: entity.data.id,
        subscriptionStatus: entity.data.status,
        subscriptionNextBilledAt: entity.data.nextBilledAt ? new Date(entity.data.nextBilledAt) : null,
        subscriptionEndDate:
          scheduledChange && scheduledChange.action === 'cancel' ? new Date(scheduledChange.effectiveAt) : null,
        productId,
        priceId,
      });

      const orgUser = (await dbOrganization.getOrganizationUsersWithDetails(organizationId))[0];
      if (orgUser) {
        const isCancellation = scheduledChange?.action === 'cancel';

        await vemetric.trackEvent(isCancellation ? 'SubscriptionCancelled' : 'SubscriptionUpdated', {
          userIdentifier: orgUser.userId,
          userData: {
            set: {
              isPaid: entity.data.status === 'active',
              productId,
            },
          },
        });

        // Send cancellation feedback email
        if (isCancellation) {
          await sendPaddleTransactionalMail(orgUser.user.email, {
            template: 'subscriptionCancelled',
            props: {
              userName: orgUser.user.name,
            },
          });
        }
      }
      break;
    }
    case EventName.TransactionCompleted: {
      const conversionType = getTransactionConversionType(entity.data.origin);
      if (!conversionType) {
        break;
      }

      const organizationId = await resolveOrganizationIdForTransaction(entity.data);
      if (!organizationId) {
        logger.warn({ transactionId: entity.data.id }, 'Paddle: no organizationId found for completed transaction');
        break;
      }

      const organization = await dbOrganization.findById(organizationId);
      // Only report conversions for organizations referred by an affiliate partner.
      if (!organization?.affiliateCode) {
        break;
      }

      const amount = getTransactionNetAmount(entity.data.details?.totals);
      if (amount === null) {
        logger.warn(
          { transactionId: entity.data.id, organizationId },
          'Paddle: could not determine net amount for completed transaction',
        );
        break;
      }

      try {
        await reportKlibonConversion({
          eventId: entity.data.id,
          type: conversionType,
          amount,
          currency: entity.data.details?.totals?.currencyCode ?? entity.data.currencyCode,
          customerId: organizationId,
          referralCode: organization.affiliateCode,
          paymentId: entity.data.id,
          subscriptionId: entity.data.subscriptionId,
        });
      } catch (err) {
        if (err instanceof KlibonRetryableError) {
          return context.text('', 500);
        }
        throw err;
      }
      break;
    }
    case EventName.AdjustmentCreated:
    case EventName.AdjustmentUpdated: {
      const isCommissionReversal =
        (entity.data.action === 'refund' || entity.data.action === 'chargeback') && entity.data.status === 'approved';
      if (!isCommissionReversal) {
        break;
      }

      const organizationId = await resolveOrganizationIdForAdjustment(entity.data);
      if (!organizationId) {
        logger.warn(
          { adjustmentId: entity.data.id, transactionId: entity.data.transactionId },
          'Paddle: no organizationId found for approved refund adjustment',
        );
        break;
      }

      const organization = await dbOrganization.findById(organizationId);
      // Only report refunds for organizations referred by an affiliate partner.
      if (!organization?.affiliateCode) {
        break;
      }

      const amount = getAdjustmentRefundAmount(entity.data.totals);
      if (amount === null) {
        logger.warn(
          { adjustmentId: entity.data.id, organizationId },
          'Paddle: could not determine refund amount for adjustment',
        );
        break;
      }

      try {
        await reportKlibonConversion({
          eventId: entity.data.id,
          type: 'refund',
          amount,
          currency: entity.data.totals.currencyCode ?? entity.data.currencyCode,
          customerId: organizationId,
          paymentId: entity.data.transactionId,
          subscriptionId: entity.data.subscriptionId,
        });
      } catch (err) {
        if (err instanceof KlibonRetryableError) {
          return context.text('', 500);
        }
        throw err;
      }
      break;
    }
  }

  return context.text('', 200);
};
