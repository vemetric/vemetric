import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getSubscriptionStatus } from '../utils/billing';
import { logger } from '../utils/logger';
import { paddleApi } from '../utils/paddle';
import { organizationProcedure, organizationAdminProcedure, router, projectOrPublicProcedure } from '../utils/trpc';
import { getCurrentUsageCycle, getUsagePerOrganization } from '../utils/usage';

export const billingRouter = router({
  billingStatus: organizationProcedure.query(async (opts) => {
    const {
      ctx: { organization, billingInfo, subscriptionStatus },
    } = opts;

    const currentUsageCycle = await getCurrentUsageCycle(organization, billingInfo);
    const usageStats = await getUsagePerOrganization(
      organization.id,
      currentUsageCycle.startDate,
      currentUsageCycle.endDate,
    );

    return {
      ...subscriptionStatus,
      usageStats,
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
      ctx: { organizationId, billingInfo, organization },
    } = opts;

    const currentUsageCycle = await getCurrentUsageCycle(organization, billingInfo);
    const usageStats = await getUsagePerOrganization(
      organizationId,
      currentUsageCycle.startDate,
      currentUsageCycle.endDate,
    );

    const subscriptionStatus = await getSubscriptionStatus(billingInfo);

    return {
      ...subscriptionStatus,
      subscriptionEndDate: billingInfo?.subscriptionEndDate,
      subscriptionNextBilledAt: billingInfo?.subscriptionNextBilledAt,
      usageResetDate: currentUsageCycle.endDate,
      usageStats,
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
      } = opts;

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

      if (
        !preview.updateSummary ||
        !preview.nextBilledAt ||
        isNaN(Number(preview.updateSummary.result.amount)) ||
        isNaN(Number(preview.updateSummary.charge.amount))
      ) {
        logger.error({ organizationId, newPriceId, preview }, 'Failed to retrieve preview update');
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve preview update' });
      }

      const immediateCharge = Number(preview.updateSummary.result.amount) / 100;
      const nextCharge = Number(preview.updateSummary.charge.amount) / 100;

      return {
        immediateCharge,
        nextCharge,
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
