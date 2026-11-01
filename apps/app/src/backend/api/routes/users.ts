import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { commonErrorResponses, errorResponses, projectRequestHeaders, rateLimitResponseHeaders } from '../openapi';
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
  operationId: 'listUsers',
  tags: ['Users'],
  summary: 'List users',
  description: 'Returns a list of users with optional filters, sorting and date range.',
  request: {
    headers: projectRequestHeaders,
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
      headers: rateLimitResponseHeaders,
      content: {
        'application/json': {
          schema: usersListResponseSchema,
        },
      },
    },
    403: errorResponses.forbidden,
    404: errorResponses.projectNotFound,
    ...commonErrorResponses,
  },
});

const usersSingleRoute = createRoute({
  method: 'get',
  path: '/v1/users/single',
  operationId: 'getUser',
  tags: ['Users'],
  summary: 'Get user',
  description: 'Returns one user by id or identifier.',
  request: {
    headers: projectRequestHeaders,
    query: userSingleQuerySchema,
  },
  responses: {
    200: {
      description: 'Success',
      headers: rateLimitResponseHeaders,
      content: {
        'application/json': {
          schema: usersSingleResponseSchema,
        },
      },
    },
    404: errorResponses.userNotFound,
    ...commonErrorResponses,
  },
});

const userEventsRoute = createRoute({
  method: 'post',
  path: '/v1/users/events',
  operationId: 'listUserEvents',
  tags: ['Users'],
  summary: 'List user events',
  description: 'Returns events for one user within a specified date range and with optional filters.',
  request: {
    headers: projectRequestHeaders,
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
      headers: rateLimitResponseHeaders,
      content: {
        'application/json': {
          schema: userEventsResponseSchema,
        },
      },
    },
    403: errorResponses.forbidden,
    404: errorResponses.userNotFound,
    ...commonErrorResponses,
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
