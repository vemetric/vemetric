import type { GeoData } from 'clickhouse';
import type { Project } from 'database';
import type { Context } from 'hono';

export type HonoContextVars = {
  projectId: bigint;
  project: Project;
  allowCookies: boolean;
  proxyHost?: string;
  ipAddress: string;
  geoData: GeoData;
  isBackendRequest: boolean;
};

export type HonoContext = Context<{ Variables: HonoContextVars }>;
