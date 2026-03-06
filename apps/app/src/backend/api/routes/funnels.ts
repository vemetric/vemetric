import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import type { FunnelStep } from '@vemetric/common/funnel';
import { dbFunnel } from 'database';
import { authorizationHeaderSchema, commonOpenApiErrorResponses } from '../schemas/common';
import { funnelsListResponseSchema } from '../schemas/funnels';
import type { PublicApiHonoEnv } from '../types';
import { mapFunnelStepToApi } from '../utils/funnel-step-mapper';

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

export function registerFunnelRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(funnelsListRoute, async ({ json, var: { project } }) => {
    const funnels = await dbFunnel.findByProjectId(project.id);

    return json(
      {
        funnels: funnels.map((funnel) => ({
          id: funnel.id,
          name: funnel.name,
          icon: funnel.icon,
          steps: (funnel.steps as FunnelStep[]).map((step) => mapFunnelStepToApi(step)),
          createdAt: funnel.createdAt.toISOString(),
          updatedAt: funnel.updatedAt.toISOString(),
        })),
      },
      200,
    );
  });
}
