import type { EventEntity } from '@paddle/paddle-node-sdk';
import { EventName } from '@paddle/paddle-node-sdk';
import { getClientIp } from '@vemetric/common/request-ip';
import type { BillingInfo } from 'database';
import { dbBillingInfo, dbOrganization } from 'database';
import type { HonoContext } from '../types';
import { logger } from '../utils/logger';
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

export const paddleWebhookHandler = async (context: HonoContext) => {
  const entity = await validateWebhook(context);
  if (!entity) {
    return context.text('', 400);
  }

  const organizationId =
    'customData' in entity.data ? (entity.data.customData as { organizationId: string }).organizationId : null;
  if (!organizationId) {
    logger.error({ entity }, 'Paddle: no organizationId found in custom data');
    return context.text('', 400);
  }

  switch (entity.eventType) {
    case EventName.SubscriptionCreated: {
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
      const orgUser = (await dbOrganization.getOrganizationUsers(organizationId))[0];
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
      }
      break;
    }
    case EventName.SubscriptionUpdated: {
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

      const orgUser = (await dbOrganization.getOrganizationUsers(organizationId))[0];
      if (orgUser) {
        await vemetric.trackEvent(
          scheduledChange?.action === 'cancel' ? 'SubscriptionCancelled' : 'SubscriptionUpdated',
          {
            userIdentifier: orgUser.userId,
            userData: {
              set: {
                isPaid: entity.data.status === 'active',
                productId,
              },
            },
          },
        );
      }
      break;
    }
  }

  return context.text('', 200);
};
