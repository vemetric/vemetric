import { INVITATION_EXPIRY_MS, INVITATION_TOKEN_PATTERN } from '@vemetric/common/invitation';
import { z } from 'zod';

/** Name of the cookie the backend reads the invitation token of a signup from. */
const INVITATION_TOKEN_COOKIE = 'invitation_token';

/** Validates an invitation token carried in a URL. */
export const invitationTokenSchema = z.string().regex(INVITATION_TOKEN_PATTERN);

/** Search parameters the signup route reads. */
export interface InvitationSearch {
  invitationToken?: string;
}

/**
 * Validates the search of the signup route while leaving everything else in place.
 *
 * The router replaces a route's search with whatever its validator returns, so anything dropped
 * here disappears from the URL. The signup page is a landing page for campaigns, so `utm_*`,
 * `ref` and friends have to survive. A schema that declares them would need an index signature,
 * and that signature leaks into the router's link types and breaks inference across the whole
 * app, so the unknown keys are carried through at runtime and left out of the type instead.
 *
 * A malformed token is dropped rather than forwarded to the backend.
 * @param search The raw search parameters of the request.
 * @returns The search with a validated invitation token, every other parameter untouched.
 */
export function parseInvitationSearch(search: Record<string, unknown>): InvitationSearch {
  const parsed = invitationTokenSchema.safeParse(search.invitationToken);

  return {
    ...search,
    invitationToken: parsed.success ? parsed.data : undefined,
  } as InvitationSearch;
}

/**
 * Checks whether a value is a well formed invitation token.
 *
 * @param token The value to check.
 * @returns true if the value has the shape of an invitation token.
 */
export function isValidInvitationToken(token: string): boolean {
  return INVITATION_TOKEN_PATTERN.test(token);
}

/**
 * Stores the invitation token of a pending invite in a cookie.
 *
 * An OAuth signup creates the account in the provider callback, a request the frontend does not
 * control and cannot attach a query parameter to, so the token has to survive the redirect in a
 * cookie. `SameSite=Lax` is what makes it travel with that top level callback navigation while
 * keeping it off cross site requests. The lifetime matches the invitation itself, so the cookie
 * never outlives what it unlocks.
 *
 * The token only contains characters that are safe in a cookie value, and it is validated
 * before it is written, so no attribute can be smuggled in through it.
 * @param token The invitation token to store.
 */
export function setInvitationTokenCookie(token: string): void {
  if (!isValidInvitationToken(token)) {
    return;
  }

  const maxAgeSeconds = Math.floor(INVITATION_EXPIRY_MS / 1000);
  // Self hosted instances are reachable over plain http, where a Secure cookie would never be
  // stored, so the attribute follows the protocol the page was served over.
  const secureAttribute = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${INVITATION_TOKEN_COOKIE}=${token}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secureAttribute}`;
}

/**
 * Removes the invitation token cookie once it has served its purpose.
 */
export function clearInvitationTokenCookie(): void {
  const secureAttribute = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${INVITATION_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secureAttribute}`;
}

/**
 * Reads the invitation token this browser stored while it went through an invited signup.
 *
 * Used to tell an invitation that was just consumed by the signup apart from a link that was
 * never valid: only a browser that came through the invite flow carries the cookie.
 * @returns The stored token, or undefined if there is none or it is malformed.
 */
export function getInvitationTokenCookie(): string | undefined {
  const entry = document.cookie.split('; ').find((candidate) => candidate.startsWith(`${INVITATION_TOKEN_COOKIE}=`));
  if (!entry) {
    return undefined;
  }

  const value = entry.slice(INVITATION_TOKEN_COOKIE.length + 1);
  return isValidInvitationToken(value) ? value : undefined;
}
