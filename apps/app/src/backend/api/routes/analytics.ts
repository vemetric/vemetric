import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { requireProject } from '../middleware/project';
import { commonErrorResponses, errorResponses, projectRequestHeaders, rateLimitResponseHeaders } from '../openapi';
import { analyticsQueryRequestSchema, analyticsQueryResponseSchema } from '../schemas/analytics';
import { queryAnalytics } from '../services/analytics';
import type { PublicApiHonoEnv } from '../types';

const analyticsRoute = createRoute({
  method: 'post',
  path: '/v1/analytics/query',
  operationId: 'queryAnalytics',
  tags: ['Analytics'],
  summary: 'Query analytics',
  description: 'Query analytics metrics with optional grouping, sorting and filters.',
  middleware: requireProject,
  request: {
    headers: projectRequestHeaders,
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
      headers: rateLimitResponseHeaders,
      content: {
        'application/json': {
          schema: analyticsQueryResponseSchema,
        },
      },
    },
    403: errorResponses.forbidden,
    404: errorResponses.projectNotFound,
    ...commonErrorResponses,
  },
});

export function registerAnalyticsRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(analyticsRoute, async ({ req, json, var: vars }) => {
    return json(await queryAnalytics(vars, req.valid('json')), 200);
  });
}
