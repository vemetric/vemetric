export const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isInvitationExpired(createdAt: Date | string): boolean {
  const created = new Date(createdAt);
  return Date.now() - created.getTime() > INVITATION_EXPIRY_MS;
}
