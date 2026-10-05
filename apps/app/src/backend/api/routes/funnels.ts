import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import {
  authorizationHeaderSchema,
  commonOpenApiErrorResponses,
  planLimitExceededOpenApiResponse,
} from '../schemas/common';
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
  summary: 'List funnels',
  description: 'Returns the list of funnels for the authenticated project.',
  request: {
    headers: authorizationHeaderSchema,
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: funnelsListResponseSchema,
        },
      },
    },
    ...commonOpenApiErrorResponses,
  },
});

const funnelResultsRoute = createRoute({
  method: 'post',
  path: '/v1/funnels/{id}',
  summary: 'Get funnel results',
  description: 'Returns results for a funnel in the given date range and with optional filters.',
  request: {
    headers: authorizationHeaderSchema,
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
      content: {
        'application/json': {
          schema: funnelResultsResponseSchema,
        },
      },
    },
    403: planLimitExceededOpenApiResponse,
    404: {
      description: 'Funnel was not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.object({
              code: z.literal('FUNNEL_NOT_FOUND'),
              message: z.string(),
            }),
          }),
        },
      },
    },
    ...commonOpenApiErrorResponses,
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
