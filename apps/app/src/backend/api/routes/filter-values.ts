import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { requireProject } from '../middleware/project';
import { commonErrorResponses, errorResponses, projectRequestHeaders, rateLimitResponseHeaders } from '../openapi';
import { filterValuesRequestSchema, filterValuesResponseSchema } from '../schemas/filter-values';
import { getFilterValues } from '../services/filter-values';
import type { PublicApiHonoEnv } from '../types';

const filterValuesRoute = createRoute({
  method: 'post',
  path: '/v1/filters/values',
  operationId: 'getFilterValues',
  tags: ['Filters'],
  summary: 'Get filter values',
  description: 'Returns available filter values for one or more fields with pagination.',
  middleware: requireProject,
  request: {
    headers: projectRequestHeaders,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: filterValuesRequestSchema,
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
          schema: filterValuesResponseSchema,
        },
      },
    },
    403: errorResponses.forbidden,
    404: errorResponses.projectNotFound,
    ...commonErrorResponses,
  },
});

export function registerFilterValueRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(filterValuesRoute, async ({ req, json, var: vars }) => {
    return json(await getFilterValues(vars, req.valid('json')), 200);
  });
}
