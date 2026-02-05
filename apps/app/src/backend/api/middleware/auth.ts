import { createHash } from 'crypto';
import type { ApiKey, Project } from '@prisma/client';
import { prismaClient } from 'database';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export type ApiKeyWithProject = ApiKey & { project: Project };

export type PublicApiEnv = {
  Variables: {
    apiKey: ApiKeyWithProject;
    project: Project;
  };
};

export const authMiddleware = createMiddleware<PublicApiEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing API key. Use Authorization: Bearer <key>' });
  }

  const rawKey = authHeader.slice(7);
  const keyHash = sha256(rawKey);

  const apiKey = await prismaClient.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    include: { project: true },
  });

  if (!apiKey) {
    throw new HTTPException(401, { message: 'Invalid or revoked API key' });
  }

  c.set('apiKey', apiKey);
  c.set('project', apiKey.project);

  await next();
});
