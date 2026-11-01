import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import { commonErrorResponses, errorResponses, projectRequestHeaders, rateLimitResponseHeaders } from '../openapi';
import {
  funnelIdSchema,
  funnelResultsRequestSchema,
  funnelResultsResponseSchema,
  funnelsListResponseSchema,
} from '../schemas/funnels';
import { getFunnelResults, listFunnels } from '../services/funnels';
import type { PublicApiHonoEnv } from '../types';

const funnelsListRoute = createRoute({
  method: 'get',
  path: '/v1/funnels',
  operationId: 'listFunnels',
  tags: ['Funnels'],
  summary: 'List funnels',
  description: 'Returns the list of funnels for the authenticated project.',
  request: {
    headers: projectRequestHeaders,
  },
  responses: {
    200: {
      description: 'Success',
      headers: rateLimitResponseHeaders,
      content: {
        'application/json': {
          schema: funnelsListResponseSchema,
        },
      },
    },
    404: errorResponses.projectNotFound,
    ...commonErrorResponses,
  },
});

const funnelResultsRoute = createRoute({
  method: 'post',
  path: '/v1/funnels/{id}',
  operationId: 'getFunnelResults',
  tags: ['Funnels'],
  summary: 'Get funnel results',
  description: 'Returns results for a funnel in the given date range and with optional filters.',
  request: {
    headers: projectRequestHeaders,
    params: z.object({
      id: funnelIdSchema,
    }),
    body: {
      required: true,
      content: {
        'application/json': {
          schema: funnelResultsRequestSchema,
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
          schema: funnelResultsResponseSchema,
        },
      },
    },
    403: errorResponses.forbidden,
    404: errorResponses.funnelNotFound,
    ...commonErrorResponses,
  },
});

export function registerFunnelRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(funnelsListRoute, async ({ json, var: vars }) => {
    return json(await listFunnels(vars), 200);
  });

  api.openapi(funnelResultsRoute, async ({ req, json, var: vars }) => {
    const { id } = req.valid('param');
    return json(await getFunnelResults(vars, id, req.valid('json')), 200);
  });
}
