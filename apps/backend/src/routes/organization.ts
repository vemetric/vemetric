import { TRPCError } from '@trpc/server';
import { OrganizationRole, dbAuthUser, dbOrganization } from 'database';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { loggedInProcedure, router } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

export const organizationRouter = router({
  create: loggedInProcedure
    .input(z.object({ firstName: z.string().min(2), organizationName: z.string().min(2) }))
    .mutation(async (opts) => {
      const {
        input: { firstName, organizationName },
        ctx: { user },
      } = opts;

      const userOrganizations = await dbOrganization.getUserOrganizations(user.id);
      if (userOrganizations.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User already has an organization' });
      }

      const organization = await dbOrganization.create(organizationName);
      await dbOrganization.addUser(organization.id, user.id, OrganizationRole.ADMIN);
      await dbAuthUser.updateName(user.id, firstName);

      try {
        await vemetric.trackEvent('OrganizationCreated', {
          userIdentifier: user.id,
          eventData: { organizationId: String(organization.id) },
          userData: { setOnce: { createdOrganization: true } },
        });
      } catch (err) {
        logger.error({ err }, 'Track event error');
      }

      logger.info('Onboarding complete', { userId: user.id, organizationId: organization.id });
    }),
  pricingOnboarding: loggedInProcedure.mutation(async (opts) => {
    const {
      ctx: { user },
    } = opts;

    const userOrganizations = await dbOrganization.getUserOrganizations(user.id);
    if (userOrganizations.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'User has no organization' });
    }

    await dbOrganization.update(userOrganizations[0].organizationId, {
      pricingOnboarded: true,
    });
  }),
});
