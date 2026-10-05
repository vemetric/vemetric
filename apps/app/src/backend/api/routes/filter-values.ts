import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import {
  authorizationHeaderSchema,
  commonOpenApiErrorResponses,
  planLimitExceededOpenApiResponse,
} from '../schemas/common';
import { filterValuesRequestSchema, filterValuesResponseSchema } from '../schemas/filter-values';
import { getFilterValues } from '../services/filter-values';
import type { PublicApiHonoEnv } from '../types';

const filterValuesRoute = createRoute({
  method: 'post',
  path: '/v1/filters/values',
  summary: 'Get filter values',
  description: 'Returns available filter values for one or more fields with pagination.',
  request: {
    headers: authorizationHeaderSchema,
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
      content: {
        'application/json': {
          schema: filterValuesResponseSchema,
        },
      },
    },
    403: planLimitExceededOpenApiResponse,
    ...commonOpenApiErrorResponses,
  },
});

export function registerFilterValueRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(filterValuesRoute, async ({ req, json, var: vars }) => {
    return json(await getFilterValues(vars, req.valid('json')), 200);
  });
}
