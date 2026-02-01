import type { appRouter } from './src/server';
import type { auth } from './src/server/utils/auth';

export type AppRouter = typeof appRouter;
export type Auth = typeof auth;
