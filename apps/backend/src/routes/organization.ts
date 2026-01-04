import { OrganizationRole, dbAuthUser, dbOrganization } from 'database';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { loggedInProcedure, organizationAdminProcedure, router } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

export const organizationRouter = router({
  create: loggedInProcedure
    .input(z.object({ firstName: z.string().min(2).optional(), organizationName: z.string().min(2) }))
    .mutation(async (opts) => {
      const {
        input: { firstName, organizationName },
        ctx: { user },
      } = opts;

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
