import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { auth } from '../auth';
import { appRouter } from './router';
import type { TrpcContext } from './types';
import { logger } from '../utils/logger';
import { getClientIpFromHeaders } from '../utils/request-ip';

export async function createContext(req: Request): Promise<TrpcContext> {
  const session = await auth.api.getSession({ headers: req.headers });

  return {
    req,
    var: {
      ipAddress: getClientIpFromHeaders(req.headers),
      session: session?.session ?? null,
      user: session?.user ?? null,
    },
  };
}

export function handleTRPCRequest(request: Request) {
  return fetchRequestHandler({
    endpoint: '/trpc',
    req: request,
    router: appRouter,
    createContext: ({ req }) => createContext(req),
    onError: ({ error, path, input }) => {
      const clientErrorCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_REQUEST'];
      if (clientErrorCodes.includes(error.code)) {
        return;
      }
      logger.error({ err: error, path, input }, 'An error occured');
    },
  });
}
