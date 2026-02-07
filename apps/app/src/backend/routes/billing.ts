import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { logger } from '../utils/backend-logger';
import { paddleApi } from '../utils/paddle';
import { organizationProcedure, organizationAdminProcedure, router, projectOrPublicProcedure } from '../utils/trpc';
import { getUsageCycles } from '../utils/usage';

export const billingRouter = router({
  billingStatus: organizationProcedure.query(async (opts) => {
    const {
      ctx: { organization, billingInfo, subscriptionStatus },
    } = opts;

    const usageCycles = await getUsageCycles(organization.id, organization, billingInfo, 2);

    return {
      ...subscriptionStatus,
      usageCycles,
    };
  }),
  subscriptionActive: projectOrPublicProcedure.query(async (opts) => {
    const {
      ctx: { subscriptionStatus },
    } = opts;

    return {
      isSubscriptionActive: subscriptionStatus.isActive,
    };
  }),
  billingInfo: organizationAdminProcedure.query(async (opts) => {
    const {
      ctx: { organizationId, billingInfo, organization, subscriptionStatus },
    } = opts;

    const usageCycles = await getUsageCycles(organizationId, organization, billingInfo, 2);

    return {
      ...subscriptionStatus,
      subscriptionEndDate: billingInfo?.subscriptionEndDate,
      subscriptionNextBilledAt: billingInfo?.subscriptionNextBilledAt,
      usageCycles,
    };
  }),
  managmentUrls: organizationAdminProcedure.query(async (opts) => {
    const {
      ctx: { billingInfo },
    } = opts;

    if (!billingInfo) {
      return null;
    }

    const subscription = await paddleApi.subscriptions.get(billingInfo.subscriptionId);

    return {
      updatePaymentMethodUrl: subscription.managementUrls?.updatePaymentMethod,
      cancelSubscriptionUrl: subscription.managementUrls?.cancel,
    };
  }),
  billingHistory: organizationAdminProcedure.query(async (opts) => {
    const {
      ctx: { billingInfo },
    } = opts;

    if (!billingInfo) {
      return [];
    }

    const billingHistory = await paddleApi.transactions.list({
      customerId: [billingInfo.customerId],
      perPage: 100,
    });
    const transactions = await billingHistory.next();

    return transactions
      .filter((transaction) => Boolean(transaction.invoiceNumber))
      .map((transaction) => ({
        id: transaction.id,
        createdAt: transaction.createdAt,
        status: transaction.status,
        invoiceNumber: transaction.invoiceNumber,
      }));
  }),
  downloadInvoice: organizationAdminProcedure
    .input(
      z.object({
        transactionId: z.string().min(3),
      }),
    )
    .mutation(async (opts) => {
      const {
        input: { transactionId },
        ctx: { billingInfo },
      } = opts;

      if (!billingInfo) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing info not found' });
      }

      const transaction = await paddleApi.transactions.get(transactionId);
      if (transaction.customerId !== billingInfo.customerId) {
        logger.warn(
          { transactionId, transactionCustomerId: transaction.customerId, billingCustomerId: billingInfo.customerId },
          'Attempt to access transaction for different customer',
        );
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Transaction not found' });
      }

      const invoicePDF = await paddleApi.transactions.getInvoicePDF(transactionId);
      return { url: invoicePDF.url };
    }),
  undoCancellation: organizationAdminProcedure.mutation(async (opts) => {
    const {
      ctx: { billingInfo },
    } = opts;

    if (!billingInfo) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing info not found' });
    }

    await paddleApi.subscriptions.update(billingInfo.subscriptionId, {
      scheduledChange: null,
    });
  }),
  updatePreview: organizationAdminProcedure
    .input(
      z.object({
        newPriceId: z.string().min(3),
      }),
    )
    .mutation(async (opts) => {
      const {
        input: { newPriceId },
        ctx: { organizationId, billingInfo },
      } = opts;

      if (!billingInfo) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing info not found' });
      }

      const preview = await paddleApi.subscriptions.previewUpdate(billingInfo.subscriptionId, {
        prorationBillingMode: 'prorated_immediately',
        items: [
          {
            priceId: newPriceId,
            quantity: 1,
          },
        ],
      });

      if (!preview.updateSummary || !preview.nextBilledAt || isNaN(Number(preview.updateSummary.result.amount))) {
        logger.error({ organizationId, newPriceId, preview }, 'Failed to retrieve preview update');
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve preview update' });
      }

      const immediateCharge = Number(preview.updateSummary.result.amount) / 100;

      return {
        immediateCharge,
        nextBillingDate: preview.nextBilledAt,
      };
    }),
  updateSubscription: organizationAdminProcedure
    .input(
      z.object({
        newPriceId: z.string().min(3),
      }),
    )
    .mutation(async (opts) => {
      const {
        input: { newPriceId },
        ctx: { billingInfo },
      } = opts;

      if (!billingInfo) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing info not found' });
      }

      await paddleApi.subscriptions.update(billingInfo.subscriptionId, {
        prorationBillingMode: 'prorated_immediately',
        items: [
          {
            priceId: newPriceId,
            quantity: 1,
          },
        ],
      });
    }),
});
