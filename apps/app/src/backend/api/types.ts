import type { AuthenticatedApiKey, Project } from 'database';
import type { ApiError } from './utils/errors';
import type { SubscriptionStatus } from '../utils/billing';

export type PublicApiHonoVars = {
  apiKey: AuthenticatedApiKey;
  /** Set when the request names a project; guaranteed on routes with the `requireProject` middleware. */
  project: Project;
  /** A failed project lookup, thrown after the rate limiter so the request still counts. */
  projectError?: ApiError;
  subscriptionStatus: SubscriptionStatus;
  requestContent?: string;
};

export type PublicApiHonoEnv = {
  Variables: PublicApiHonoVars;
};
