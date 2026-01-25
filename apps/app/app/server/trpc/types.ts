import type { auth } from '../auth';

export type ServerContextVars = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  ipAddress: string | null;
};

export type ServerContext = {
  var: ServerContextVars;
};
