import type { AuthenticatedApiKey, Project } from 'database';
import type { SubscriptionStatus } from '../utils/billing';

export type PublicApiHonoVars = {
  apiKey: AuthenticatedApiKey;
  /** Set when the request names a project; guaranteed on routes with the `requireProject` middleware. */
  project: Project;
  subscriptionStatus: SubscriptionStatus;
  requestContent?: string;
};

export type PublicApiHonoEnv = {
  Variables: PublicApiHonoVars;
};
