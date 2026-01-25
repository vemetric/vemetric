import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './router';
import type { ServerContext } from './types';
import { auth } from '../auth';
import { logger } from '../utils/logger';

// Helper to extract IP address from request
function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return null;
}

export async function createContext(request: Request): Promise<ServerContext> {
  const session = await auth.api.getSession({ headers: request.headers });

  return {
    var: {
      user: session?.user ?? null,
      session: session?.session ?? null,
      ipAddress: getClientIp(request),
    },
  };
}

export async function handleTRPCRequest(request: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: '/trpc',
    req: request,
    router: appRouter,
    createContext: () => createContext(request),
    onError: ({ error, path, input }) => {
      // Only log actual server errors, not expected client errors
      const clientErrorCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_REQUEST'];
      if (clientErrorCodes.includes(error.code)) {
        return;
      }
      logger.error({ err: error, path, input }, 'tRPC error');
    },
  });
}
