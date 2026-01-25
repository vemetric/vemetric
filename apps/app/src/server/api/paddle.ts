import type { EventEntity } from '@paddle/paddle-node-sdk';
import { EventName } from '@paddle/paddle-node-sdk';
import { sendTransactionalMail } from '@vemetric/email/transactional';
import type { BillingInfo } from 'database';
import { dbBillingInfo, dbOrganization } from 'database';
import { logger } from '../utils/logger';
import { paddleApi } from '../utils/paddle';
import { getClientIpFromHeaders } from '../utils/request-ip';
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

async function validateWebhook(request: Request): Promise<EventEntity | null> {
  const ip = getClientIpFromHeaders(request.headers);
  if (!ip || !allowedIpAdresses.includes(ip)) {
    logger.error({ ip }, 'No valid paddle ip address');
    return null;
  }

  const signature = request.headers.get('paddle-signature') || '';
  const rawRequestBody = await request.text();

  try {
    if (signature && rawRequestBody) {
      return await paddleApi.webhooks.unmarshal(rawRequestBody, secretKey, signature);
    }
    logger.error('Paddle Signature missing in header');
    return null;
  } catch (err) {
    logger.error({ err }, 'Error validating paddle webhook');
    return null;
  }
}

export async function handlePaddleWebhook(request: Request): Promise<Response> {
  const entity = await validateWebhook(request);
  if (!entity) {
    return new Response('', { status: 400 });
  }

  const organizationId =
    'customData' in entity.data ? (entity.data.customData as { organizationId: string }).organizationId : null;
  if (!organizationId) {
    logger.error({ entity }, 'Paddle: no organizationId found in custom data');
    return new Response('', { status: 400 });
  }

  switch (entity.eventType) {
    case EventName.SubscriptionCreated: {
      const productId = entity.data.items[0].product?.id;
      if (!productId) {
        logger.error({ entity }, 'Paddle: no productId found in subscription created event');
        return new Response('', { status: 400 });
      }

      const priceId = entity.data.items[0].price?.id;
      if (!priceId) {
        logger.error({ entity }, 'Paddle: no priceId found in subscription created event');
        return new Response('', { status: 400 });
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
        return new Response('', { status: 400 });
      }

      const priceId = entity.data.items[0].price?.id;
      if (!priceId) {
        logger.error({ entity }, 'Paddle: no priceId found in subscription updated event');
        return new Response('', { status: 400 });
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

        if (isCancellation) {
          await sendTransactionalMail(orgUser.user.email, {
            template: 'subscriptionCancelled',
            props: {
              userName: orgUser.user.name,
            },
          });
        }
      }
      break;
    }
  }

  return new Response('', { status: 200 });
}
