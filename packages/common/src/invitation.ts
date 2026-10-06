/** How long an invitation stays valid after it was created. */
export const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Shape of the tokens produced by `generateToken()` in the database package.
 *
 * Shared between the frontend, which validates a token before it puts it into a cookie or a
 * query string, and the backend signup guard, which checks the shape before it touches the
 * database. A single definition keeps the two from drifting apart, which would either reject
 * valid invitations or let malformed input through into a query.
 */
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Determines whether an invitation has outlived `INVITATION_EXPIRY_MS`.
 *
 * @param createdAt When the invitation was created.
 * @returns true if the invitation is no longer valid.
 */
export function isInvitationExpired(createdAt: Date | string): boolean {
  const created = new Date(createdAt);
  return Date.now() - created.getTime() > INVITATION_EXPIRY_MS;
}
