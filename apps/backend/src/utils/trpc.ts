import * as Sentry from '@sentry/bun';
import { TRPCError, initTRPC } from '@trpc/server';
import { dbOrganization, dbProject, OrganizationRole } from 'database';
import superjson from 'superjson';
import { z } from 'zod';
import type { HonoContext } from '../types';
import { getSubscriptionStatus } from './billing';

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

    const subscriptionStatus = await getSubscriptionStatus(organization.billingInfo);

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

    const subscriptionStatus = await getSubscriptionStatus(organization.billingInfo);

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

  const hasAccess = await dbProject.hasUserAccess(input.projectId, user.id);
  if (!hasAccess) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No permissions to access this project' });
  }

  const project = await dbProject.findById(input.projectId);
  if (!project) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
  }

  const organization = await dbOrganization.findById(project.organizationId);
  if (!organization) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
  }

  const subscriptionStatus = await getSubscriptionStatus(organization.billingInfo);

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

      const hasAccess = await dbProject.hasUserAccess(project.id, user.id);
      if (!hasAccess) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No permissions to access this project' });
      }
    }

    const organization = await dbOrganization.findById(project.organizationId);
    if (!organization) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    const subscriptionStatus = await getSubscriptionStatus(organization.billingInfo);
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
