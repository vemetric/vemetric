/**
 * Shared invitation acceptance logic.
 *
 * Two paths let a user join an organization through an invitation: the regular
 * `organization.acceptInvitation` procedure, used by an already existing account, and the
 * signup guard on instances that run with `ALLOW_REGISTRATION=false`, where the invitation is
 * what allows the account to be created in the first place. Both go through the same checks
 * here so the member limit, the project access restrictions and the deletion of the used
 * invitation cannot drift apart between them.
 */
import type { OrganizationRole } from 'database';
import { dbInvitation, dbInvitationProjectAccess, dbOrganization, dbUserProjectAccess, serializableTransaction } from 'database';
import { getSubscriptionStatus } from './billing';

/** Members an organization may have while it is not on a paid plan. */
export const MAX_FREE_PLAN_MEMBERS = 2;

/** Reasons a user cannot be joined to the organization of an otherwise valid invitation. */
export type InvitationJoinFailure = 'ORGANIZATION_NOT_FOUND' | 'ALREADY_MEMBER' | 'MEMBER_LIMIT_REACHED';

/**
 * Raised when an invitation is valid but the join itself is not allowed. Carries a reason so
 * each caller can map it onto the error shape of its own transport.
 */
export class InvitationJoinError extends Error {
  constructor(
    readonly reason: InvitationJoinFailure,
    message: string,
  ) {
    super(message);
    this.name = 'InvitationJoinError';
  }
}

interface JoinOrganizationOptions {
  /** User that joins the organization. */
  userId: string;
  /** Organization the invitation belongs to. */
  organizationId: string;
  /** Role the invitation grants. */
  role: OrganizationRole;
  /** Token of the invitation, needed to resolve its project access and to delete it. */
  token: string;
  /**
   * Project ids the invitation restricts the member to. Pass them when the invitation row is
   * already gone, since deleting it cascades to its project access rows. When omitted they
   * are read inside the transaction.
   */
  projectIds?: Array<string>;
  /**
   * Whether the invitation row still has to be deleted as part of the join. False for a
   * signup that already consumed the invitation while guarding the registration.
   */
  consumeInvitation: boolean;
}

/**
 * Joins a user to the organization an invitation was issued for.
 *
 * Everything runs in one serializable transaction: the member limit of the free plan is
 * pointless if a second concurrent accept can slip past it between the count and the insert.
 * @param options Invitation data, target user and whether the invitation still has to be deleted.
 * @returns The organization the user joined.
 * @throws InvitationJoinError if the organization is gone, the user is already a member, or
 * the organization has reached the member limit of the free plan.
 */
export async function joinOrganizationFromInvitation(options: JoinOrganizationOptions) {
  const { userId, organizationId, role, token, projectIds, consumeInvitation } = options;

  const organization = await dbOrganization.findById(organizationId);
  if (!organization) {
    throw new InvitationJoinError('ORGANIZATION_NOT_FOUND', 'Organization not found');
  }

  const subscriptionStatus = await getSubscriptionStatus(organization);

  return serializableTransaction(async (client) => {
    const userMembership = await dbOrganization.countMembers({ organizationId, userId, client });
    if (userMembership > 0) {
      throw new InvitationJoinError('ALREADY_MEMBER', 'You are already a member of this organization');
    }

    if (!subscriptionStatus.isActive) {
      const memberCount = await dbOrganization.countMembers({ organizationId, client });
      if (memberCount >= MAX_FREE_PLAN_MEMBERS) {
        throw new InvitationJoinError(
          'MEMBER_LIMIT_REACHED',
          'This organization has reached its member limit on the free plan. Please ask an admin to upgrade to add more members.',
        );
      }
    }

    await dbOrganization.addUser({ organizationId, userId, role, client });

    // Project access restrictions only exist for members, admins always see every project.
    if (role === 'MEMBER') {
      const restrictedProjectIds =
        projectIds ??
        (await dbInvitationProjectAccess.getProjectIds({ invitationToken: token, organizationId, client }));

      if (restrictedProjectIds.length > 0) {
        await dbUserProjectAccess.setUserProjectAccess({
          userId,
          organizationId,
          projectIds: restrictedProjectIds,
          client,
        });
      }
    }

    if (consumeInvitation) {
      await dbInvitation.delete({ token, client });
    }

    return { organizationId, organizationName: organization.name };
  });
}

/** An invitation that has been consumed and is waiting to be applied to a new account. */
export interface ClaimedInvitation {
  token: string;
  organizationId: string;
  role: OrganizationRole;
  projectIds: Array<string>;
  claimedAt: number;
}

/**
 * Claims that survive only until the signup that consumed them reaches its follow up hook.
 * Both hooks run in the same process for the same request, so a process local map is enough,
 * and it must not be shared: an entry is valid for exactly one account creation.
 */
const claimedInvitations = new Map<string, ClaimedInvitation>();

/**
 * Upper bound for the gap between consuming an invitation and creating the account. Anything
 * older belongs to a signup that never completed and is dropped so the map cannot grow
 * without bound.
 */
const CLAIM_RETENTION_MS = 60_000;

/** Drops claims left behind by signups that failed between the two hooks. */
function pruneExpiredClaims() {
  const oldestAllowed = Date.now() - CLAIM_RETENTION_MS;
  // Map.forEach instead of for...of: the server build targets a lib without Map iteration.
  // Deleting the current entry inside forEach is safe for Map.
  claimedInvitations.forEach((claim, token) => {
    if (claim.claimedAt < oldestAllowed) {
      claimedInvitations.delete(token);
    }
  });
}

/**
 * Consumes a pending invitation and remembers it for the account that is about to be created.
 *
 * The invitation is deleted here, before the account exists, and not afterwards. The deletion
 * is the only atomic gate available without a schema change: two signups racing on the same
 * link both pass a read only check, while only one of them can delete the row. Doing it later
 * would mean both accounts get created and only then find out that one of them is not
 * entitled to exist.
 *
 * The price is that a signup which fails after this point, for example because the email is
 * already taken, burns the invitation: it is gone and the admin has to send a new one. That
 * is the deliberate trade, a wasted invite link instead of an unbounded number of accounts
 * created from a single one.
 * @param token Invitation token taken from the signup request.
 * @returns The claimed invitation, or null if it was not pending or another request won it.
 */
export async function claimInvitationForSignup(token: string): Promise<ClaimedInvitation | null> {
  const invitation = await dbInvitation.findByToken(token);
  if (!invitation) {
    return null;
  }

  // Read before deleting: the invitation's project access rows cascade away with it.
  const projectIds = await dbInvitationProjectAccess.getProjectIds({
    invitationToken: token,
    organizationId: invitation.organizationId,
  });

  if (!(await dbInvitation.consumePending({ token }))) {
    return null;
  }

  pruneExpiredClaims();

  const claim: ClaimedInvitation = {
    token,
    organizationId: invitation.organizationId,
    role: invitation.role,
    projectIds,
    claimedAt: Date.now(),
  };
  claimedInvitations.set(token, claim);

  return claim;
}

/**
 * Hands out the claim belonging to a token exactly once.
 * @param token Invitation token taken from the signup request.
 * @returns The claim, or undefined if this signup did not claim an invitation.
 */
export function takeClaimedInvitation(token: string | undefined): ClaimedInvitation | undefined {
  if (!token) {
    return undefined;
  }

  const claim = claimedInvitations.get(token);
  if (claim) {
    claimedInvitations.delete(token);
  }

  return claim;
}
