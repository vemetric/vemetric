import type { ApiKey, Project } from 'database';

export type PublicApiVars = {
  apiKey: ApiKey;
  project: Project;
};

export type PublicApiEnv = {
  Variables: PublicApiVars;
};
