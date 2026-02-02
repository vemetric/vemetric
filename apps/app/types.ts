import type { trpcRouter } from './src/server/backend-app';
import type { auth } from './src/server/utils/auth';

export type TrpcRouter = typeof trpcRouter;
export type Auth = typeof auth;
