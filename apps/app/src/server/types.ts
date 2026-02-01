import type { Context } from 'hono';
import type { auth } from './utils/auth';

export type HonoContextVars = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  ipAddress: string | null;
};

export type HonoContext = Context<{ Variables: HonoContextVars }>;
