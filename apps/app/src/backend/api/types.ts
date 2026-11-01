import type { AuthenticatedApiKey, Project } from 'database';
import type { SubscriptionStatus } from '../utils/billing';

export type PublicApiHonoVars = {
  apiKey: AuthenticatedApiKey;
  /** Set for every route except `GET /v1/projects`. */
  project: Project;
  subscriptionStatus: SubscriptionStatus;
  requestContent?: string;
};

export type PublicApiHonoEnv = {
  Variables: PublicApiHonoVars;
};
