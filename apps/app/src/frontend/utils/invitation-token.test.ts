import { INVITATION_EXPIRY_MS } from '@vemetric/common/invitation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearInvitationTokenCookie,
  getInvitationTokenCookie,
  invitationTokenSchema,
  parseInvitationSearch,
  isValidInvitationToken,
  setInvitationTokenCookie,
} from './invitation-token';

const VALID_TOKEN = 'abc_DEF-12345678';

/** Captures what the module writes to `document.cookie`. */
let written: string[];

/**
 * Replaces the cookie accessor so the attributes of a write can be asserted, which reading
 * `document.cookie` back would drop.
 * @returns The list the writes are recorded into.
 */
function captureCookieWrites() {
  written = [];
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation((value: string) => {
    written.push(value);
  });
  return written;
}

beforeEach(() => {
  captureCookieWrites();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('isValidInvitationToken', () => {
  it.each(['abcdefgh', VALID_TOKEN, 'A'.repeat(64)])('accepts the well formed token %s', (token) => {
    expect(isValidInvitationToken(token)).toBe(true);
  });

  it.each([
    ['too short', 'abcdefg'],
    ['too long', 'A'.repeat(65)],
    ['empty', ''],
    ['with a dot', 'abcdefg.h'],
    ['with a semicolon', 'abcdefg;h'],
    ['with a space', 'abcdef gh'],
    ['with markup', '<script>abcd'],
  ])('rejects a token that is %s', (_name, token) => {
    expect(isValidInvitationToken(token)).toBe(false);
  });

  it('is the same rule the schema applies', () => {
    expect(invitationTokenSchema.safeParse(VALID_TOKEN).success).toBe(true);
    expect(invitationTokenSchema.safeParse('abcdefg;h').success).toBe(false);
  });
});

describe('setInvitationTokenCookie', () => {
  it('writes the token with the attributes the OAuth callback needs', () => {
    setInvitationTokenCookie(VALID_TOKEN);

    expect(written).toHaveLength(1);
    const [cookie] = written;
    expect(cookie).toContain(`invitation_token=${VALID_TOKEN}`);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('expires the cookie together with the invitation it unlocks', () => {
    setInvitationTokenCookie(VALID_TOKEN);

    expect(written[0]).toContain(`Max-Age=${INVITATION_EXPIRY_MS / 1000}`);
  });

  it('omits Secure on a plain http instance, where the cookie would be dropped', () => {
    setInvitationTokenCookie(VALID_TOKEN);

    expect(written[0]).not.toContain('Secure');
  });

  it('sets Secure when the page is served over https', () => {
    vi.stubGlobal('location', { protocol: 'https:' });

    setInvitationTokenCookie(VALID_TOKEN);

    expect(written[0]).toContain('; Secure');
  });

  it('writes nothing at all for a malformed token', () => {
    setInvitationTokenCookie('not a token');
    setInvitationTokenCookie('');

    expect(written).toHaveLength(0);
  });
});

describe('clearInvitationTokenCookie', () => {
  it('expires the cookie immediately on the same path', () => {
    clearInvitationTokenCookie();

    expect(written[0]).toContain('invitation_token=;');
    expect(written[0]).toContain('Max-Age=0');
    expect(written[0]).toContain('Path=/');
  });
});

describe('getInvitationTokenCookie', () => {
  /**
   * Makes reading `document.cookie` return the given jar.
   * @param value The raw cookie header the document should report.
   */
  const stubCookieJar = (value: string) => {
    vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue(value);
  };

  it('reads the token back', () => {
    stubCookieJar(`auth.session=xyz; invitation_token=${VALID_TOKEN}`);

    expect(getInvitationTokenCookie()).toBe(VALID_TOKEN);
  });

  it('returns nothing when no invitation cookie is present', () => {
    stubCookieJar('auth.session=xyz');

    expect(getInvitationTokenCookie()).toBeUndefined();
  });

  it('does not mistake a cookie whose name merely ends the same way', () => {
    stubCookieJar(`other_invitation_token=${VALID_TOKEN}`);

    expect(getInvitationTokenCookie()).toBeUndefined();
  });

  it('drops a malformed value instead of handing it on', () => {
    stubCookieJar('invitation_token=not a token');

    expect(getInvitationTokenCookie()).toBeUndefined();
  });
});

describe('parseInvitationSearch', () => {
  // The router replaces a route's search with whatever its validator returns, so anything the
  // validator drops disappears from the URL.
  const parseSearch = (search: Record<string, unknown>) => parseInvitationSearch(search);

  it('keeps campaign parameters next to the invitation token', () => {
    expect(parseSearch({ utm_source: 'newsletter', ref: 'partner', invitationToken: VALID_TOKEN })).toEqual({
      utm_source: 'newsletter',
      ref: 'partner',
      invitationToken: VALID_TOKEN,
    });
  });

  it('keeps campaign parameters when no invitation is involved', () => {
    expect(parseSearch({ utm_source: 'x', utm_medium: 'cpc' })).toEqual({ utm_source: 'x', utm_medium: 'cpc' });
  });

  it('drops a malformed token instead of forwarding it', () => {
    expect(parseSearch({ utm_source: 'x', invitationToken: 'not a token' })).toEqual({
      utm_source: 'x',
      invitationToken: undefined,
    });
  });

  it('accepts a search without any parameters', () => {
    expect(parseSearch({})).toEqual({ invitationToken: undefined });
  });
});
