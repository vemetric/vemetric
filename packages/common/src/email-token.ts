import { createHmac, timingSafeEqual } from 'crypto';

const SEPARATOR = '.';

function getSecret(): string {
  const secret = process.env.EMAIL_TOKEN_SECRET;
  if (!secret) throw new Error('EMAIL_TOKEN_SECRET must be set');
  return secret;
}

function createHash(userId: string) {
  return createHmac('sha256', getSecret()).update(userId).digest('base64url').slice(0, 16);
}

export function createUnsubscribeToken(userId: string): string {
  const hash = createHash(userId);
  return `${userId}${SEPARATOR}${hash}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [userId, hash] = token.split(SEPARATOR);
  if (!userId || !hash) return null;

  const expectedHash = createHash(userId);

  try {
    const hashBuffer = Buffer.from(hash, 'base64url');
    const expectedBuffer = Buffer.from(expectedHash, 'base64url');
    return timingSafeEqual(hashBuffer, expectedBuffer) ? userId : null;
  } catch {
    return null;
  }
}
