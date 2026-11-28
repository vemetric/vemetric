import { getBackendUrl } from './url';

/**
 * When an app (e.g. Claude) asks for access, the OAuth provider sends users without a session to the login page with
 * the signed authorize parameters. After signing in (or signing up and verifying the email, or a social login), the
 * flow continues by calling the authorize endpoint again with the same parameters, which then shows the consent page.
 */

const PENDING_AUTHORIZE_KEY = 'oauthPendingAuthorize';
/** The signed parameters expire after 10 minutes (`codeExpiresIn`); give users a bit longer to verify their email. */
const PENDING_AUTHORIZE_MAX_AGE_MS = 30 * 60 * 1000;
/** Parameters the provider adds for signing; the authorize endpoint gets the client's original ones. */
const SIGNING_PARAMS = new Set(['sig', 'exp', 'ba_iat', 'ba_param', 'ba_pl']);

function hasSignedOauthQuery(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('sig') && params.has('client_id');
}

/**
 * The signed parameters of the current page, as the consent endpoint and our `oauth` routes expect them: the signature
 * plus the parameters it covers (listed in `ba_param`).
 */
export function getSignedOauthQuery(search = window.location.search): string | null {
  const params = new URLSearchParams(search);
  const signedNames = new Set(params.getAll('ba_param'));
  if (!params.has('sig') || signedNames.size === 0) {
    return null;
  }

  const signed = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key === 'sig' || key === 'ba_param' || signedNames.has(key)) {
      signed.append(key, value);
    }
  }
  return signed.toString();
}

/**
 * Remembers the authorize request when the login or signup page is part of an OAuth flow. Every sign-in ends on
 * /redirect, which continues it with `resumePendingOauthAuthorize`.
 */
export function rememberPendingOauthAuthorize(search = window.location.search) {
  if (!hasSignedOauthQuery(search)) {
    return;
  }

  const params = new URLSearchParams(search);
  for (const name of SIGNING_PARAMS) {
    params.delete(name);
  }
  // The user just signed in, so asking for a login again would loop.
  if (params.get('prompt') === 'login') {
    params.delete('prompt');
  }

  const url = `${getBackendUrl()}/_api/auth/oauth2/authorize?${params.toString()}`;
  try {
    localStorage.setItem(PENDING_AUTHORIZE_KEY, JSON.stringify({ url, createdAt: Date.now() }));
  } catch {
    // Without storage (private mode), users connect again from their app after signing in.
  }
}

export function clearPendingOauthAuthorize() {
  try {
    localStorage.removeItem(PENDING_AUTHORIZE_KEY);
  } catch {
    // ignore
  }
}

/** Continues a remembered OAuth flow after the user signed in. Returns whether it navigated away. */
export function resumePendingOauthAuthorize(): boolean {
  let pending: { url?: unknown; createdAt?: unknown } | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(PENDING_AUTHORIZE_KEY) ?? 'null');
  } catch {
    pending = null;
  }
  clearPendingOauthAuthorize();

  if (
    typeof pending?.url !== 'string' ||
    typeof pending.createdAt !== 'number' ||
    Date.now() - pending.createdAt > PENDING_AUTHORIZE_MAX_AGE_MS ||
    !pending.url.startsWith(`${getBackendUrl()}/_api/auth/oauth2/authorize?`)
  ) {
    return false;
  }

  window.location.href = pending.url;
  return true;
}
