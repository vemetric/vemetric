import { TRPCError } from '@trpc/server';
import {
  OrganizationRole,
  dbAuthUser,
  dbInvitation,
  dbOrganization,
  dbProject,
  dbUserProjectAccess,
  prismaClient,
} from 'database';
import { z } from 'zod';
import { getSubscriptionStatus } from '../utils/billing';
import { logger } from '../utils/logger';
import { loggedInProcedure, organizationAdminProcedure, publicProcedure, router } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

const MAX_FREE_ORGANIZATIONS = 2;
const MAX_FREE_PLAN_MEMBERS = 2;
const inputName = z.string().min(2).max(100);

export const organizationRouter = router({
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
      members: members.map((member) => {
        const userAccess = member.user.projectAccess;
        // ADMINs always have full access, MEMBERs with no entries have full access
        const hasFullAccess = member.role === 'ADMIN' || !userAccess || userAccess.length === 0;
        const accessibleCount = userAccess.length;

        return {
          userId: member.userId,
          role: member.role,
          createdAt: member.createdAt,
          user: member.user,
          projectAccess: {
            hasFullAccess,
            accessibleCount,
          },
        };
      }),
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

      // When promoting to ADMIN, clear any project access restrictions since ADMINs have full access
      if (role === 'ADMIN') {
        await dbUserProjectAccess.removeAllRestrictions(userId, organizationId);
      }
      await dbOrganization.updateUserRole(organizationId, userId, role as OrganizationRole);

      return { success: true };
    }),

  memberProjectAccess: organizationAdminProcedure.input(z.object({ userId: z.string() })).query(async (opts) => {
    const {
      input: { organizationId, userId },
    } = opts;

    const accessibleProjectIds = await dbUserProjectAccess.getUserProjectIds(userId, organizationId);
    const hasRestrictions = accessibleProjectIds.length > 0;

    return {
      accessibleProjectIds,
      hasRestrictions,
    };
  }),

  updateMemberProjectAccess: organizationAdminProcedure
    .input(
      z.object({
        userId: z.string(),
        projectIds: z.array(z.string()),
        hasRestrictions: z.boolean(),
      }),
    )
    .mutation(async (opts) => {
      const {
        input: { organizationId, userId, projectIds, hasRestrictions },
      } = opts;

      const member = await dbOrganization.getSingleUserOrganization(organizationId, userId);
      if (!member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found in this organization',
        });
      }

      // ADMINs always have full access - cannot restrict them
      if (member.role === 'ADMIN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot restrict project access for admins. Admins always have full access to all projects.',
        });
      }

      // Validate that all project IDs belong to this organization
      if (projectIds.length > 0) {
        const projects = await dbProject.findByOrganizationId(organizationId);
        const validProjectIds = new Set(projects.map((p) => p.id));
        const invalidIds = projectIds.filter((id) => !validProjectIds.has(id));

        if (invalidIds.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Only projects within the organization can be assigned for access.',
          });
        }
      } else if (hasRestrictions) {
        // If hasRestrictions is true but no projectIds provided, it's invalid
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Select at least one project or disable restrictions to give full access.',
        });
      }

      if (hasRestrictions) {
        await dbUserProjectAccess.setUserProjectAccess(userId, organizationId, projectIds);
      } else {
        await dbUserProjectAccess.removeAllRestrictions(userId, organizationId);
      }

      return { success: true };
    }),

  invitations: organizationAdminProcedure.query(async (opts) => {
    const {
      input: { organizationId },
    } = opts;

    const invitations = await dbInvitation.listByOrganization(organizationId);
    return { invitations };
  }),

  createInvitation: organizationAdminProcedure
    .input(z.object({ role: z.enum(['ADMIN', 'MEMBER']) }))
    .mutation(async (opts) => {
      const {
        input: { organizationId, role },
        ctx: { user, subscriptionStatus },
      } = opts;

      // Check member limit for free plan organizations
      if (!subscriptionStatus.isActive) {
        const [memberCount, pendingInvitationCount] = await Promise.all([
          dbOrganization.countMembers(organizationId),
          dbInvitation.countPendingByOrganization(organizationId),
        ]);

        if (memberCount + pendingInvitationCount >= MAX_FREE_PLAN_MEMBERS) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Your organization is on the free plan. You can only have up to ${MAX_FREE_PLAN_MEMBERS} members. Please upgrade to add more members.`,
          });
        }
      }

      const invitation = await dbInvitation.create(organizationId, user.id, role as OrganizationRole);
      return { invitation };
    }),

  revokeInvitation: organizationAdminProcedure.input(z.object({ token: z.string() })).mutation(async (opts) => {
    const {
      input: { organizationId, token },
    } = opts;

    // Verify the invitation belongs to this organization
    const invitation = await dbInvitation.findByToken(token, true);
    if (!invitation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invitation not found',
      });
    }

    if (invitation.organizationId !== organizationId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Invitation does not belong to this organization',
      });
    }

    await dbInvitation.delete(token);
    return { success: true };
  }),

  getInvitationByToken: publicProcedure.input(z.object({ token: z.string() })).query(async (opts) => {
    const {
      input: { token },
    } = opts;

    const invitation = await dbInvitation.findByToken(token);
    if (!invitation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invitation not found or has expired',
      });
    }

    return {
      organizationName: invitation.organization.name,
    };
  }),

  acceptInvitation: loggedInProcedure.input(z.object({ token: z.string() })).mutation(async (opts) => {
    const {
      input: { token },
      ctx: { user },
    } = opts;

    const invitation = await dbInvitation.findByToken(token);
    if (!invitation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invitation not found or has expired',
      });
    }

    // Check if user is already a member
    const isAlreadyMember = await dbOrganization.hasUserAccess(invitation.organizationId, user.id);
    if (isAlreadyMember) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'You are already a member of this organization',
      });
    }

    const organization = await dbOrganization.findById(invitation.organizationId);
    if (!organization) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    const subscriptionStatus = await getSubscriptionStatus(organization);

    // Check member limit for free plan organizations
    if (!subscriptionStatus.isActive) {
      const memberCount = await dbOrganization.countMembers(invitation.organizationId);
      if (memberCount >= MAX_FREE_PLAN_MEMBERS) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `This organization has reached its member limit on the free plan. Please ask an admin to upgrade to add more members.`,
        });
      }
    }

    // Add user to organization and delete invitation
    await prismaClient.$transaction([
      dbOrganization.addUser(invitation.organizationId, user.id, invitation.role),
      dbInvitation.delete(token),
    ]);

    return {
      organizationId: invitation.organizationId,
      organizationName: invitation.organization.name,
    };
  }),
});
