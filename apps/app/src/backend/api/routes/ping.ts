import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { PublicApiEnv } from '../middleware/auth';

const app = new OpenAPIHono<PublicApiEnv>();

const route = createRoute({
  method: 'get',
  path: '/ping',
  summary: 'Health check',
  description: 'Verify API key is valid and see which project it belongs to.',
  security: [{ bearerAuth: [] }],
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

app.openapi(route, (c) => {
  const project = c.get('project');
  return c.json({
    status: 'ok' as const,
    project: { id: project.id, name: project.name },
  });
});

export { app as pingRoute };
