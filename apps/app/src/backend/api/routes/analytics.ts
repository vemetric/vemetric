import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { analyticsQueryRequestSchema, analyticsQueryResponseSchema } from '../schemas/analytics';
import {
  authorizationHeaderSchema,
  commonOpenApiErrorResponses,
  planLimitExceededOpenApiResponse,
} from '../schemas/common';
import { queryAnalytics } from '../services/analytics';
import type { PublicApiHonoEnv } from '../types';

const analyticsRoute = createRoute({
  method: 'post',
  path: '/v1/analytics/query',
  summary: 'Query analytics',
  description: 'Query analytics metrics with optional grouping, sorting and filters.',
  request: {
    headers: authorizationHeaderSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: analyticsQueryRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: analyticsQueryResponseSchema,
        },
      },
    },
    403: planLimitExceededOpenApiResponse,
    ...commonOpenApiErrorResponses,
  },
});

export function registerAnalyticsRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(analyticsRoute, async ({ req, json, var: vars }) => {
    return json(await queryAnalytics(vars, req.valid('json')), 200);
  });
}
