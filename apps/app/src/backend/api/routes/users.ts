import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import {
  authorizationHeaderSchema,
  commonOpenApiErrorResponses,
  planLimitExceededOpenApiResponse,
} from '../schemas/common';
import {
  userEventsRequestSchema,
  userEventsResponseSchema,
  userSingleQuerySchema,
  usersListRequestSchema,
  usersListResponseSchema,
  usersSingleResponseSchema,
} from '../schemas/users';
import { getUser, getUserEvents, listUsers } from '../services/users';
import type { PublicApiHonoEnv } from '../types';

const usersListRoute = createRoute({
  method: 'post',
  path: '/v1/users',
  summary: 'List users',
  description: 'Returns a list of users with optional filters, sorting and date range.',
  request: {
    headers: authorizationHeaderSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: usersListRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: usersListResponseSchema,
        },
      },
    },
    403: planLimitExceededOpenApiResponse,
    ...commonOpenApiErrorResponses,
  },
});

const usersSingleRoute = createRoute({
  method: 'get',
  path: '/v1/users/single',
  summary: 'Get user',
  description: 'Returns one user by id or identifier.',
  request: {
    headers: authorizationHeaderSchema,
    query: userSingleQuerySchema,
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: usersSingleResponseSchema,
        },
      },
    },
    404: {
      description: 'User was not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z
              .object({
                code: z.literal('USER_NOT_FOUND').openapi({
                  description: 'Machine-readable error code.',
                }),
                message: z.string().openapi({
                  description: 'Human-readable error message.',
                }),
              })
              .openapi({ description: 'Error details.' }),
          }),
        },
      },
    },
    ...commonOpenApiErrorResponses,
  },
});

const userEventsRoute = createRoute({
  method: 'post',
  path: '/v1/users/events',
  summary: 'List user events',
  description: 'Returns events for one user within a specified date range and with optional filters.',
  request: {
    headers: authorizationHeaderSchema,
    query: userSingleQuerySchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: userEventsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: userEventsResponseSchema,
        },
      },
    },
    403: planLimitExceededOpenApiResponse,
    404: {
      description: 'User was not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z
              .object({
                code: z.literal('USER_NOT_FOUND').openapi({
                  description: 'Machine-readable error code.',
                }),
                message: z.string().openapi({
                  description: 'Human-readable error message.',
                }),
              })
              .openapi({ description: 'Error details.' }),
          }),
        },
      },
    },
    ...commonOpenApiErrorResponses,
  },
});

export function registerUserRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(usersListRoute, async ({ req, json, var: vars }) => {
    return json(await listUsers(vars, req.valid('json')), 200);
  });

  api.openapi(usersSingleRoute, async ({ req, json, var: vars }) => {
    return json(await getUser(vars, req.valid('query')), 200);
  });

  api.openapi(userEventsRoute, async ({ req, json, var: vars }) => {
    return json(await getUserEvents(vars, req.valid('query'), req.valid('json')), 200);
  });
}
