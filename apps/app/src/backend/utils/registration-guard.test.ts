import { APIError } from 'better-auth/api';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyClaimedInvitation, assertRegistrationAllowed, extractInvitationToken } from './registration-guard';

const {
  findFirstMock,
  tryAcquireMock,
  reclaimIfStaleMock,
  claimInvitationForSignupMock,
  takeClaimedInvitationMock,
  joinOrganizationFromInvitationMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  tryAcquireMock: vi.fn(),
  reclaimIfStaleMock: vi.fn(),
  claimInvitationForSignupMock: vi.fn(),
  takeClaimedInvitationMock: vi.fn(),
  joinOrganizationFromInvitationMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('database', () => ({
  prismaClient: {
    user: {
      findFirst: findFirstMock,
    },
  },
  dbBootstrapLock: {
    tryAcquire: tryAcquireMock,
    reclaimIfStale: reclaimIfStaleMock,
  },
}));

vi.mock('./invitation', () => ({
  claimInvitationForSignup: claimInvitationForSignupMock,
  joinOrganizationFromInvitation: joinOrganizationFromInvitationMock,
  takeClaimedInvitation: takeClaimedInvitationMock,
}));

vi.mock('./backend-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: loggerErrorMock },
}));

const VALID_TOKEN = 'aBcDeFgH12345678';

describe('extractInvitationToken', () => {
  it('reads the token from the query string of the signup request', () => {
    expect(extractInvitationToken(`https://app.vemetric.com/_api/auth/sign-up/email?invitationToken=${VALID_TOKEN}`, null)).toBe(
      VALID_TOKEN,
    );
  });

  it('falls back to the cookie, which is what an OAuth callback carries', () => {
    expect(extractInvitationToken('https://app.vemetric.com/_api/auth/callback/github', VALID_TOKEN)).toBe(VALID_TOKEN);
  });

  it('prefers the query string over the cookie', () => {
    expect(extractInvitationToken(`https://app.vemetric.com/signup?invitationToken=${VALID_TOKEN}`, 'otherToken12345')).toBe(
      VALID_TOKEN,
    );
  });

  it('ignores a malformed query token and keeps looking', () => {
    expect(extractInvitationToken('https://app.vemetric.com/signup?invitationToken=not%20a%20token', VALID_TOKEN)).toBe(
      VALID_TOKEN,
    );
  });

  it('returns undefined without a token', () => {
    expect(extractInvitationToken('https://app.vemetric.com/signup', null)).toBeUndefined();
  });

  it('returns undefined for a malformed token', () => {
    expect(extractInvitationToken(undefined, "'; drop table invitation; --")).toBeUndefined();
  });

  it('survives a request url that does not parse', () => {
    expect(extractInvitationToken('not-a-url', VALID_TOKEN)).toBe(VALID_TOKEN);
  });
});

describe('assertRegistrationAllowed', () => {
  const findFirst = findFirstMock as Mock;
  const tryAcquire = tryAcquireMock as Mock;
  const reclaimIfStale = reclaimIfStaleMock as Mock;
  const claimInvitationForSignup = claimInvitationForSignupMock as Mock;

  beforeEach(() => {
    findFirst.mockReset();
    tryAcquire.mockReset();
    reclaimIfStale.mockReset();
    claimInvitationForSignup.mockReset();
    findFirst.mockResolvedValue(null);
    tryAcquire.mockResolvedValue(false);
    reclaimIfStale.mockResolvedValue(false);
    claimInvitationForSignup.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.ALLOW_REGISTRATION;
  });

  it('lets every signup through when the flag is unset, which is the hosted deployment', async () => {
    await expect(assertRegistrationAllowed(undefined)).resolves.toBeUndefined();

    expect(findFirst).not.toHaveBeenCalled();
    expect(tryAcquire).not.toHaveBeenCalled();
    expect(claimInvitationForSignup).not.toHaveBeenCalled();
  });

  it('lets every signup through when the flag is set to true', async () => {
    process.env.ALLOW_REGISTRATION = 'true';

    await expect(assertRegistrationAllowed(undefined)).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('refuses to start guessing on an unrecognised flag value', async () => {
    process.env.ALLOW_REGISTRATION = 'off';

    await expect(assertRegistrationAllowed(undefined)).rejects.toThrowError(/ALLOW_REGISTRATION/);
  });

  it('allows the first account by claiming the bootstrap lock', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    tryAcquire.mockResolvedValue(true);

    await expect(assertRegistrationAllowed(undefined)).resolves.toBeUndefined();

    expect(tryAcquire).toHaveBeenCalledTimes(1);
    expect(claimInvitationForSignup).not.toHaveBeenCalled();
  });

  it('rejects a second concurrent bootstrap whose lock is still fresh', async () => {
    process.env.ALLOW_REGISTRATION = 'false';

    await expect(assertRegistrationAllowed(undefined)).rejects.toBeInstanceOf(APIError);
    expect(reclaimIfStale).toHaveBeenCalledTimes(1);
  });

  it('allows a bootstrap that reclaims a stale lock', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    reclaimIfStale.mockResolvedValue(true);

    await expect(assertRegistrationAllowed(undefined)).resolves.toBeUndefined();
  });

  it('rejects an uninvited signup once the instance has an account', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    findFirst.mockResolvedValue({ id: 'user-1' });

    await expect(assertRegistrationAllowed(undefined)).rejects.toBeInstanceOf(APIError);
    expect(tryAcquire).not.toHaveBeenCalled();
  });

  it('allows an invited signup without touching the bootstrap lock', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    findFirst.mockResolvedValue({ id: 'user-1' });
    claimInvitationForSignup.mockResolvedValue({
      token: VALID_TOKEN,
      organizationId: 'org-1',
      role: 'MEMBER',
      projectIds: [],
      claimedAt: Date.now(),
    });

    await expect(assertRegistrationAllowed(VALID_TOKEN)).resolves.toBeUndefined();

    expect(claimInvitationForSignup).toHaveBeenCalledWith(VALID_TOKEN);
    expect(tryAcquire).not.toHaveBeenCalled();
    expect(reclaimIfStale).not.toHaveBeenCalled();
  });

  it('rejects a signup whose invitation was already consumed', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    findFirst.mockResolvedValue({ id: 'user-1' });

    await expect(assertRegistrationAllowed(VALID_TOKEN)).rejects.toBeInstanceOf(APIError);
    expect(claimInvitationForSignup).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it('does not look up an invitation when the request carries no token', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    findFirst.mockResolvedValue({ id: 'user-1' });

    await expect(assertRegistrationAllowed(undefined)).rejects.toBeInstanceOf(APIError);
    expect(claimInvitationForSignup).not.toHaveBeenCalled();
  });
});

describe('applyClaimedInvitation', () => {
  const takeClaimedInvitation = takeClaimedInvitationMock as Mock;
  const joinOrganizationFromInvitation = joinOrganizationFromInvitationMock as Mock;
  const loggerError = loggerErrorMock as Mock;

  const claim = {
    token: VALID_TOKEN,
    organizationId: 'org-1',
    role: 'MEMBER' as const,
    projectIds: ['project-1'],
    claimedAt: Date.now(),
  };

  beforeEach(() => {
    takeClaimedInvitation.mockReset();
    joinOrganizationFromInvitation.mockReset();
    loggerError.mockReset();
  });

  it('joins the new account to the organization of the claimed invitation', async () => {
    takeClaimedInvitation.mockReturnValue(claim);
    joinOrganizationFromInvitation.mockResolvedValue({ organizationId: 'org-1', organizationName: 'Org' });

    await applyClaimedInvitation('user-1', VALID_TOKEN);

    // The claim is handed out exactly once, which is what removes it from the pending map.
    expect(takeClaimedInvitation).toHaveBeenCalledWith(VALID_TOKEN);
    expect(joinOrganizationFromInvitation).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'MEMBER',
      token: VALID_TOKEN,
      projectIds: ['project-1'],
      consumeInvitation: false,
    });
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('does nothing when the signup did not claim an invitation', async () => {
    takeClaimedInvitation.mockReturnValue(undefined);

    await applyClaimedInvitation('user-1', undefined);

    expect(joinOrganizationFromInvitation).not.toHaveBeenCalled();
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('logs a failed join instead of failing the signup that already exists', async () => {
    takeClaimedInvitation.mockReturnValue(claim);
    joinOrganizationFromInvitation.mockRejectedValue(new Error('member limit reached'));

    await expect(applyClaimedInvitation('user-1', VALID_TOKEN)).resolves.toBeUndefined();

    expect(takeClaimedInvitation).toHaveBeenCalledWith(VALID_TOKEN);
    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerError.mock.calls[0][0]).toMatchObject({ userId: 'user-1', organizationId: 'org-1' });
  });
});
