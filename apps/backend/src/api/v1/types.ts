import type { ApiKey, Project, Organization, BillingInfo } from 'database';
import type { Context } from 'hono';

export type SubscriptionTier = 'free' | 'paid';

export interface ApiKeyWithRelations extends ApiKey {
  project: Project & {
    organization: Organization & {
      billingInfo: BillingInfo | null;
    };
  };
}

export interface ApiContext {
  apiKey: ApiKeyWithRelations;
  projectId: bigint;
  project: Project;
  organization: Organization;
  subscriptionTier: SubscriptionTier;
}

export type ApiContextVars = {
  api: ApiContext;
};

export type ApiHonoContext = Context<{ Variables: ApiContextVars }>;

export interface ApiResponse<T> {
  data: T;
  meta: {
    project_id: string;
    period: {
      start: string;
      end: string;
    };
    generated_at: string;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ApiResponse<T[]>['meta'] & {
    pagination: {
      limit: number;
      offset: number;
      total?: number;
    };
  };
}

export type Period = '24h' | '7d' | '30d' | '3m' | '6m' | '1y';
