/**
 * Signup guard for instances that restrict who may create an account.
 *
 * Kept apart from the better-auth setup in `auth.ts` so the rules can be reasoned about, and
 * tested, without constructing the auth instance and everything it pulls in.
 */
import { INVITATION_TOKEN_PATTERN } from '@vemetric/common/invitation';
import { parseStrictBooleanEnv } from '@vemetric/common/self-hosted';
import { APIError } from 'better-auth/api';
import { dbBootstrapLock, prismaClient } from 'database';
import { logger } from './backend-logger';
import { claimInvitationForSignup, joinOrganizationFromInvitation, takeClaimedInvitation } from './invitation';

const registrationDisabledError = () =>
  new APIError('FORBIDDEN', { message: 'Registration is disabled on this instance.' });

/**
 * Reads the `ALLOW_REGISTRATION` switch. Registration is open unless the flag explicitly
 * turns it off, which is what keeps the hosted deployment, where the flag is unset,
 * behaving exactly as before. An unrecognised value throws instead of quietly opening
 * registration up.
 * @returns true if signups are open on this instance.
 */
export function isRegistrationAllowed(): boolean {
  return parseStrictBooleanEnv('ALLOW_REGISTRATION', true);
}

/** Query parameter and cookie an invited signup carries its invitation token in. */
export const INVITATION_TOKEN_PARAM = 'invitationToken';
export const INVITATION_TOKEN_COOKIE = 'invitation_token';

/**
 * Reads the invitation token a signup request carries.
 *
 * Two carriers are supported because the two signup flows differ: an email and password
 * signup is a single request and can carry the token in the query string, while an OAuth
 * signup creates the user in the provider callback, a later request that only a cookie
 * survives into.
 * @param requestUrl Absolute URL of the signup request, if the call came in over HTTP.
 * @param cookieValue Value of the invitation cookie, if it was sent.
 * @returns The token if one was sent and is well formed, undefined otherwise.
 */
export function extractInvitationToken(requestUrl: string | undefined, cookieValue: string | null): string | undefined {
  const candidates: Array<string | null | undefined> = [];

  if (requestUrl) {
    try {
      candidates.push(new URL(requestUrl).searchParams.get(INVITATION_TOKEN_PARAM));
    } catch {
      // A request URL that does not parse simply carries no token.
    }
  }
  candidates.push(cookieValue);

  return candidates.find((candidate): candidate is string => !!candidate && INVITATION_TOKEN_PATTERN.test(candidate));
}

/**
 * Consumes the invitation a signup carries, if the token is valid.
 *
 * The invitation token is the only credential the invite flow has: `acceptInvitation` lets
 * any logged in user join an organization on the strength of the token alone, so whoever
 * holds a pending token can already become a member. Letting that same holder create the
 * account they need for it does not widen the trust model.
 *
 * The invitation is consumed here rather than after the account exists, because the
 * conditional delete is what makes one link good for exactly one account. See
 * `claimInvitationForSignup` for what that costs when the signup then fails.
 *
 * Note that invitations are link scoped, not email scoped: the `Invitation` model stores no
 * email address, so the token cannot be matched against the email being signed up with.
 * @param invitationToken Token taken from the signup request, if any.
 * @returns true if this signup consumed a pending, non expired invitation.
 */
async function consumeInvitationForSignup(invitationToken: string | undefined): Promise<boolean> {
  if (!invitationToken) {
    return false;
  }

  return (await claimInvitationForSignup(invitationToken)) !== null;
}

/**
 * Joins a freshly created account to the organization whose invitation it was created with.
 *
 * Runs after the account exists, since the membership needs its user id. A failure here
 * leaves an account that belongs to no organization and an invitation that is already
 * consumed, so it is logged loudly: the admin has to invite the account again, and the
 * invited user can be added through the regular member management in the meantime.
 * @param userId Id of the account that was just created.
 * @param invitationToken Token taken from the signup request, if any.
 */
export async function applyClaimedInvitation(userId: string, invitationToken: string | undefined) {
  const claim = takeClaimedInvitation(invitationToken);
  if (!claim) {
    return;
  }

  try {
    await joinOrganizationFromInvitation({
      userId,
      organizationId: claim.organizationId,
      role: claim.role,
      token: claim.token,
      projectIds: claim.projectIds,
      consumeInvitation: false,
    });
  } catch (err) {
    logger.error(
      { err, userId, organizationId: claim.organizationId },
      'Failed to join invited user to the organization, the invitation has already been consumed',
    );
  }
}

/**
 * Guards signups on instances that run with `ALLOW_REGISTRATION=false`.
 *
 * The very first account is always allowed so that a fresh self hosted instance can be
 * bootstrapped through the regular signup screen. Every later signup is rejected.
 *
 * A plain `findFirst` check followed by an in-memory flag is not safe here: two concurrent
 * signup requests on a fresh instance (or on separate replicas, where the flag would not even
 * be shared) can both observe "no user yet" and both get through. better-auth also does not
 * wrap this hook and the subsequent user insert in one transaction, so the check and the
 * insert cannot be made atomic by locking around them here.
 *
 * Instead, the `bootstrap_lock` table's primary key is used as the compare-and-set: exactly
 * one concurrent request can ever insert the fixed-id row, so whoever wins that insert is the
 * sole signup allowed through, regardless of process or replica. This closes the race between
 * concurrent signups. The residual gap is narrower: if the winning request then fails to
 * actually create its user (crash, validation error, etc.), the lock stays claimed with no
 * user behind it. `reclaimIfStale` bounds that gap to `BOOTSTRAP_LOCK_STALE_MS` by allowing a
 * lock old enough to no longer belong to an in-flight request to be reclaimed.
 *
 * Invited signups are the second way through. They never touch the bootstrap lock: an
 * invitation can only exist once somebody created it, so the instance is past its bootstrap
 * either way, and consuming the lock here would burn the one-time bootstrap slot of a fresh
 * instance for an ordinary team member.
 * @param invitationToken Invitation token carried by the signup request, if any.
 * @throws APIError with status FORBIDDEN if the signup is not allowed.
 */
export async function assertRegistrationAllowed(invitationToken: string | undefined) {
  if (isRegistrationAllowed()) {
    return;
  }

  const existingUser = await prismaClient.user.findFirst({ select: { id: true } });
  if (!existingUser) {
    if (await dbBootstrapLock.tryAcquire()) {
      return;
    }

    // Someone else holds the lock. No user exists yet, so give the current holder the
    // benefit of the doubt unless its lock is old enough to be considered abandoned.
    if (await dbBootstrapLock.reclaimIfStale()) {
      return;
    }
  }

  if (await consumeInvitationForSignup(invitationToken)) {
    return;
  }

  throw registrationDisabledError();
}
