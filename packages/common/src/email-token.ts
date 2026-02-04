import { createHmac, timingSafeEqual } from 'crypto';

const SEPARATOR = '.';

function getSecret(): string {
  const secret = process.env.EMAIL_TOKEN_SECRET;
  if (!secret) throw new Error('EMAIL_TOKEN_SECRET must be set');
  return secret;
}

function createHash(data: string) {
  return createHmac('sha256', getSecret()).update(data).digest('base64url').slice(0, 16);
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

// Project deletion tokens with expiry
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

interface ProjectDeletionPayload {
  projectId: string;
  userId: string;
  exp: number;
}

export function createProjectDeletionToken(projectId: string, userId: string): string {
  const exp = Date.now() + TOKEN_EXPIRY_MS;
  const payload = `${projectId}:${userId}:${exp}`;
  const hash = createHash(payload);
  // Encode as: projectId.userId.exp.hash
  return `${projectId}${SEPARATOR}${userId}${SEPARATOR}${exp}${SEPARATOR}${hash}`;
}

export function verifyProjectDeletionToken(token: string): ProjectDeletionPayload | null {
  const parts = token.split(SEPARATOR);
  if (parts.length !== 4) return null;

  const [projectId, userId, expStr, hash] = parts;
  if (!projectId || !userId || !expStr || !hash) return null;

  const exp = parseInt(expStr, 10);
  if (isNaN(exp)) return null;

  // Check if token has expired
  if (Date.now() > exp) return null;

  // Verify hash
  const payload = `${projectId}:${userId}:${exp}`;
  const expectedHash = createHash(payload);

  try {
    const hashBuffer = Buffer.from(hash, 'base64url');
    const expectedBuffer = Buffer.from(expectedHash, 'base64url');
    if (!timingSafeEqual(hashBuffer, expectedBuffer)) return null;

    return { projectId, userId, exp };
  } catch {
    return null;
  }
}
