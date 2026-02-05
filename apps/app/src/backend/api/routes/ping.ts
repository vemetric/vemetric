import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { PublicApiEnv } from '../types';

const pingRoute = new OpenAPIHono<PublicApiEnv>();

const route = createRoute({
  method: 'get',
  path: '/ping',
  summary: 'Health check',
  description: 'Verify API key is valid and return the associated project.',
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            project: z.object({
              id: z.string(),
              name: z.string(),
            }),
          }),
        },
      },
    },
  },
});

pingRoute.openapi(route, (c) => {
  const project = c.get('project');

  return c.json({
    status: 'ok' as const,
    project: {
      id: project.id,
      name: project.name,
    },
  });
});

export { pingRoute };
