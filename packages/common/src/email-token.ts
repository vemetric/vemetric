import { createHash } from 'crypto';

const SEPARATOR = '.';

function getSecret(): string {
  const secret = process.env.EMAIL_TOKEN_SECRET;
  if (!secret) throw new Error('EMAIL_TOKEN_SECRET must be set');
  return secret;
}

export function createUnsubscribeToken(userId: string): string {
  const hash = createHash('sha256')
    .update(getSecret() + userId)
    .digest('base64url')
    .slice(0, 16);
  return `${userId}${SEPARATOR}${hash}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [userId, hash] = token.split(SEPARATOR);
  if (!userId || !hash) return null;
  const expectedHash = createHash('sha256')
    .update(getSecret() + userId)
    .digest('base64url')
    .slice(0, 16);
  return hash === expectedHash ? userId : null;
}
