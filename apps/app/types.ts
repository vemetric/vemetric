import type { trpcRouter } from './src/backend/backend-app';
import type { auth } from './src/backend/utils/auth';

export type TrpcRouter = typeof trpcRouter;
export type Auth = typeof auth;
