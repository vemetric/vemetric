import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { commonOpenApiErrorResponses } from '../schemas/common';
import type { PublicApiEnv } from '../types';

const projectRoutes = new OpenAPIHono<PublicApiEnv>();

function splitCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

const route = createRoute({
  method: 'get',
  path: '/project',
  summary: 'Get project',
  description: 'Returns the data of the project associated with the provided API key.',
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            project: z.object({
              id: z.string().openapi({
                description: 'Unique project identifier',
                example: '4232882524803099',
              }),
              name: z.string().openapi({
                description: 'Name of the project',
                example: 'Vemetric',
              }),
              domain: z.string().openapi({
                description: 'Primary domain of the project',
                example: 'vemetric.com',
              }),
              token: z.string().openapi({
                description: 'Public token used for tracking',
                example: 'project_token_123',
              }),
              createdAt: z.string().datetime().openapi({
                description: 'Project creation timestamp (ISO 8601)',
                example: '2026-02-07T12:00:00.000Z',
              }),
              firstEventAt: z.string().datetime().nullable().openapi({
                description: 'Timestamp of the first ingested event, if available (ISO 8601)',
                example: '2026-02-07T12:30:00.000Z',
              }),
              hasPublicDashboard: z.boolean().openapi({
                description: 'Whether the project has public dashboard access enabled',
                example: false,
              }),
              excludedIps: z.array(z.string()).openapi({
                description: 'List of excluded IP Addresses',
                example: ['127.0.0.1'],
              }),
              excludedCountries: z.array(z.string()).openapi({
                description: 'List of excluded countries as ISO 3166-1 alpha-2 codes',
                example: ['DE', 'AT'],
              }),
            }),
          }),
        },
      },
    },
    ...commonOpenApiErrorResponses,
  },
});

projectRoutes.openapi(route, (c) => {
  const project = c.get('project');

  return c.json(
    {
      project: {
        id: project.id,
        name: project.name,
        domain: project.domain,
        token: project.token,
        createdAt: project.createdAt.toISOString(),
        firstEventAt: project.firstEventAt ? project.firstEventAt.toISOString() : null,
        hasPublicDashboard: project.publicDashboard,
        excludedIps: splitCsv(project.excludedIps),
        excludedCountries: splitCsv(project.excludedCountries),
      },
    },
    200,
  );
});

export { projectRoutes };
