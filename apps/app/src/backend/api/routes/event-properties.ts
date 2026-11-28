import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { requireProject } from '../middleware/project';
import { commonErrorResponses, errorResponses, projectRequestHeaders, rateLimitResponseHeaders } from '../openapi';
import { eventPropertiesRequestSchema, eventPropertiesResponseSchema } from '../schemas/event-properties';
import { listEventProperties } from '../services/event-properties';
import type { PublicApiHonoEnv } from '../types';

const eventPropertiesRoute = createRoute({
  method: 'post',
  path: '/v1/events/properties',
  operationId: 'listEventProperties',
  tags: ['Events'],
  summary: 'List event properties',
  description:
    'Returns the property names of one or more custom events, e.g. to group or filter by them with the `event:prop:<name>` token.',
  middleware: requireProject,
  request: {
    headers: projectRequestHeaders,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: eventPropertiesRequestSchema,
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
          schema: eventPropertiesResponseSchema,
        },
      },
    },
    403: errorResponses.forbidden,
    404: errorResponses.projectNotFound,
    ...commonErrorResponses,
  },
});

export function registerEventPropertyRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(eventPropertiesRoute, async ({ req, json, var: vars }) => {
    return json(await listEventProperties(vars, req.valid('json')), 200);
  });
}
