import { TRPCError } from '@trpc/server';
import { OrganizationRole, dbAuthUser, dbOrganization } from 'database';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { loggedInProcedure, organizationAdminProcedure, router } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

const MAX_FREE_ORGANIZATIONS = 2;

export const organizationRouter = router({
  create: loggedInProcedure
    .input(z.object({ firstName: z.string().min(2).or(z.undefined()), organizationName: z.string().min(2) }))
    .mutation(async (opts) => {
      const {
        input: { firstName, organizationName },
        ctx: { user },
      } = opts;

      // Check if user has reached the limit of free organizations
      const freeOrgCount = await dbOrganization.countUserFreeAdminOrganizations(user.id);
      if (freeOrgCount >= MAX_FREE_ORGANIZATIONS) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `You can only create up to ${MAX_FREE_ORGANIZATIONS} free organizations. Please upgrade an existing organization to create more.`,
        });
      }

      const organization = await dbOrganization.create(organizationName);
      await dbOrganization.addUser(organization.id, user.id, OrganizationRole.ADMIN);

      // Only update name if provided (for new users during initial onboarding)
      if (firstName) {
        await dbAuthUser.updateName(user.id, firstName);
      }

      try {
        await vemetric.trackEvent('OrganizationCreated', {
          userIdentifier: user.id,
          userDisplayName: firstName ?? user.name,
          eventData: { organizationId: String(organization.id) },
          userData: { setOnce: { createdOrganization: true } },
        });
      } catch (err) {
        logger.error({ err }, 'Track event error');
      }

      return { organizationId: organization.id };
    }),
  pricingOnboarding: organizationAdminProcedure.mutation(async (opts) => {
    const {
      input: { organizationId },
    } = opts;

    await dbOrganization.update(organizationId, {
      pricingOnboarded: true,
    });
  }),
});
