import * as Sentry from '@sentry/bun';
import { TRPCError, initTRPC } from '@trpc/server';
import {
  getCustomDateRangeInterval,
  isTimespanAllowed,
  TIME_SPAN_DATA,
  TIME_SPANS,
  getTimeSpanRangeMax,
  timeSpanRangeMin,
} from '@vemetric/common/charts/timespans';
import { dbOrganization, dbProject, OrganizationRole } from 'database';
import { addDays, format, isAfter, isBefore } from 'date-fns';
import superjson from 'superjson';
import { z } from 'zod';
import type { HonoContext } from '../types';
import { getSubscriptionStatus } from './billing';
import { getTimeSpanStartDate, getTimeSpanEndDate } from './timeseries';

const t = initTRPC.context<HonoContext>().create({
  transformer: superjson,
});

const sentryMiddleware = t.middleware(
  Sentry.trpcMiddleware({
    attachRpcInput: true,
  }),
);
const sentryProcedure = t.procedure.use(sentryMiddleware);

export const router = t.router;

export const publicProcedure = sentryProcedure;

export const notLoggedInProcedure = sentryProcedure.use(
  t.middleware((opts) => {
    const {
      ctx: {
        var: { session, user },
      },
    } = opts;

    if (session || user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    return opts.next({
      ctx: {
        ...opts.ctx,
        session,
        user,
      },
    });
  }),
);

export const loggedInProcedure = sentryProcedure.use(
  t.middleware((opts) => {
    const {
      ctx: {
        var: { session, user },
      },
    } = opts;

    if (!session || !user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    return opts.next({
      ctx: {
        ...opts.ctx,
        session,
        user,
      },
    });
  }),
);

export const organizationProcedure = loggedInProcedure
  .input(z.object({ organizationId: z.string() }))
  .use(async (opts) => {
    const {
      input,
      ctx: { user },
    } = opts;

    const hasAccess = await dbOrganization.hasUserAccess(input.organizationId, user.id);
    if (!hasAccess) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'No permissions to access this organization' });
    }

    const organization = await dbOrganization.findById(input.organizationId);
    if (!organization) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    const subscriptionStatus = await getSubscriptionStatus(organization);

    return opts.next({
      ctx: {
        ...opts.ctx,
        organizationId: input.organizationId,
        organization,
        billingInfo: organization.billingInfo,
        subscriptionStatus,
      },
    });
  });

export const organizationAdminProcedure = loggedInProcedure
  .input(z.object({ organizationId: z.string() }))
  .use(async (opts) => {
    const {
      input,
      ctx: { user },
    } = opts;

    const hasAccess = await dbOrganization.hasUserAccess(input.organizationId, user.id, OrganizationRole.ADMIN);
    if (!hasAccess) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'No permissions to access this organization' });
    }

    const organization = await dbOrganization.findById(input.organizationId);
    if (!organization) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    const subscriptionStatus = await getSubscriptionStatus(organization);

    return opts.next({
      ctx: {
        ...opts.ctx,
        organizationId: input.organizationId,
        organization,
        billingInfo: organization.billingInfo,
        subscriptionStatus,
      },
    });
  });

export const projectProcedure = loggedInProcedure.input(z.object({ projectId: z.string() })).use(async (opts) => {
  const {
    input,
    ctx: { user },
  } = opts;

  const project = await dbProject.findById(input.projectId);
  if (!project) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
  }

  // Check user has access to the project's organization
  const hasOrgAccess = await dbOrganization.hasUserAccess(project.organizationId, user.id);
  if (!hasOrgAccess) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No permissions to access this project' });
  }

  const organization = await dbOrganization.findById(project.organizationId);
  if (!organization) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
  }

  const subscriptionStatus = await getSubscriptionStatus(organization);

  return opts.next({
    ctx: {
      ...opts.ctx,
      projectId: BigInt(input.projectId),
      project,
      organization,
      subscriptionStatus,
    },
  });
});

export const projectOrPublicProcedure = publicProcedure
  .input(z.object({ projectId: z.string().optional(), domain: z.string().optional() }))
  .use(async (opts) => {
    const {
      input,
      ctx: {
        var: { session, user },
      },
    } = opts;

    if (!input.projectId && !input.domain) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Project not found' });
    }

    const project = input.projectId
      ? await dbProject.findById(input.projectId)
      : await dbProject.findByDomain(input.domain!);
    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    if (input.domain) {
      if (!project.publicDashboard) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found' });
      }
    } else {
      if (!session || !user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Check user has access to the project's organization
      const hasOrgAccess = await dbOrganization.hasUserAccess(project.organizationId, user.id);
      if (!hasOrgAccess) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No permissions to access this project' });
      }
    }

    const organization = await dbOrganization.findById(project.organizationId);
    if (!organization) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    const subscriptionStatus = await getSubscriptionStatus(organization);
    const isPublicDashboard = Boolean(input.domain);

    return opts.next({
      ctx: {
        ...opts.ctx,
        session,
        user,
        projectId: BigInt(project.id),
        project,
        organization,
        subscriptionStatus,
        isPublicDashboard,
      },
    });
  });

export const timespanProcedure = projectOrPublicProcedure
  .input(
    z.object({
      timespan: z.enum(TIME_SPANS),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
  .use(async (opts) => {
    const {
      input,
      ctx: { subscriptionStatus },
    } = opts;

    if (input.timespan === 'custom' && !input.startDate) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Start date is required for custom time span' });
    }

    const startDate = getTimeSpanStartDate(input.timespan, input.startDate);
    if (isNaN(startDate.getTime())) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid start date format' });
    }
    const endDate = getTimeSpanEndDate(input.timespan, input.endDate || input.startDate);

    let timeSpanData = TIME_SPAN_DATA[input.timespan];

    if (input.timespan === 'custom') {
      if (!endDate || isNaN(endDate.getTime())) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid end date format' });
      }

      if (isBefore(startDate, timeSpanRangeMin)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Start date cannot be before ${format(timeSpanRangeMin, 'yyyy-MM-dd')}`,
        });
      }
      const timeSpanRangeMax = getTimeSpanRangeMax();
      if (isAfter(endDate, addDays(timeSpanRangeMax, 2))) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `End date cannot be after ${format(timeSpanRangeMax, 'yyyy-MM-dd')}`,
        });
      }

      const interval = getCustomDateRangeInterval(startDate, endDate);
      timeSpanData = { ...timeSpanData, interval };
    }

    const upgradeMessage = 'Upgrade to the Professional plan for longer data retention';
    if (input.timespan === 'custom' && !subscriptionStatus.isActive) {
      if (isBefore(startDate, addDays(new Date(), -32))) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: upgradeMessage,
        });
      }
    } else if (!isTimespanAllowed(input.timespan, subscriptionStatus.isActive)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: upgradeMessage });
    }

    return opts.next({
      ctx: {
        ...opts.ctx,
        timeSpanData,
        startDate,
        endDate,
      },
    });
  });
