import type { ApiKey, Project } from 'database';
import type { SubscriptionStatus } from '../utils/billing';

export type PublicApiHonoVars = {
  apiKey: ApiKey;
  project: Project;
  subscriptionStatus: SubscriptionStatus;
  requestContent?: string;
};

export type PublicApiHonoEnv = {
  Variables: PublicApiHonoVars;
};
