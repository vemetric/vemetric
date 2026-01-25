import type { auth } from '../auth';

export type TrpcContext = {
  req: Request;
  var: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
    ipAddress: string | null;
  };
};
