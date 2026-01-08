import { TRPCError } from '@trpc/server';
import { OrganizationRole, dbAuthUser, dbOrganization } from 'database';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { loggedInProcedure, organizationAdminProcedure, router } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

const MAX_FREE_ORGANIZATIONS = 2;
const inputName = z.string().min(2).max(100);

export const organizationRouter = router({
  settings: organizationAdminProcedure.query(async (opts) => {
    const { organization } = opts.ctx;
    return {
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
    };
  }),
  updateSettings: organizationAdminProcedure.input(z.object({ name: inputName })).mutation(async (opts) => {
    const {
      input: { organizationId, name },
    } = opts;

    await dbOrganization.update(organizationId, { name });
    return { success: true };
  }),
  members: organizationAdminProcedure.query(async (opts) => {
    const {
      input: { organizationId },
      ctx: { user },
    } = opts;

    const members = await dbOrganization.getOrganizationUsersWithDetails(organizationId);

    return {
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        user: m.user,
      })),
      currentUserId: user.id,
    };
  }),
  removeMember: organizationAdminProcedure.input(z.object({ userId: z.string() })).mutation(async (opts) => {
    const {
      input: { organizationId, userId },
      ctx: { user },
    } = opts;

    // Cannot remove yourself
    if (userId === user.id) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'You cannot remove yourself from the organization',
      });
    }

    // Check if target user exists in the organization
    const members = await dbOrganization.getOrganizationUsers(organizationId);
    const targetMember = members.find((m) => m.userId === userId);
    if (!targetMember) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User is not a member of this organization',
      });
    }

    await dbOrganization.removeUser(organizationId, userId);
    return { success: true };
  }),
  updateMemberRole: organizationAdminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(['ADMIN', 'MEMBER']) }))
    .mutation(async (opts) => {
      const {
        input: { organizationId, userId, role },
        ctx: { user },
      } = opts;

      // Cannot change your own role
      if (userId === user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot change your own role',
        });
      }

      // Check if target user exists in the organization
      const members = await dbOrganization.getOrganizationUsers(organizationId);
      const targetMember = members.find((m) => m.userId === userId);
      if (!targetMember) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User is not a member of this organization',
        });
      }

      await dbOrganization.updateUserRole(organizationId, userId, role as OrganizationRole);
      return { success: true };
    }),
  create: loggedInProcedure
    .input(
      z.object({
        firstName: inputName.or(z.undefined()),
        organizationName: inputName,
      }),
    )
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
