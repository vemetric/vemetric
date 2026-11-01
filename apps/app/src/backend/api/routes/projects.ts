import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import { commonErrorResponses, errorResponses, projectRequestHeaders, rateLimitResponseHeaders } from '../openapi';
import { getProject, listProjects } from '../services/project';
import type { PublicApiHonoEnv } from '../types';
import { listApiKeyProjects } from '../utils/api-key-access';

const projectsListRoute = createRoute({
  method: 'get',
  path: '/v1/projects',
  operationId: 'listProjects',
  tags: ['Project'],
  summary: 'List projects',
  description:
    "Returns the projects the API key covers: the key's own project for a project key, the covered projects of the organization for an organization key. Use their IDs in the `X-Vemetric-Project` header.",
  responses: {
    200: {
      description: 'Success',
      headers: rateLimitResponseHeaders,
      content: {
        'application/json': {
          schema: z.object({
            projects: z
              .array(
                z.object({
                  id: z.string().openapi({ description: 'Project ID', example: '1234567890123456' }),
                  name: z.string().openapi({ description: 'Project name', example: 'My Website' }),
                  domain: z.string().openapi({ description: 'Project domain', example: 'example.com' }),
                }),
              )
              .openapi({ description: 'Projects the API key covers, sorted by name.' }),
          }),
        },
      },
    },
    ...commonErrorResponses,
  },
});

const projectRoute = createRoute({
  method: 'get',
  path: '/v1/project',
  operationId: 'getProject',
  tags: ['Project'],
  summary: 'Get project',
  description:
    "Returns the data of the project: the key's own project for a project key, the project in the `X-Vemetric-Project` header for an organization key.",
  request: {
    headers: projectRequestHeaders,
  },
  responses: {
    200: {
      description: 'Success',
      headers: rateLimitResponseHeaders,
      content: {
        'application/json': {
          schema: z.object({
            project: z
              .object({
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
                createdAt: z.iso.datetime().openapi({
                  description: 'Project creation timestamp (ISO 8601)',
                  example: '2026-02-07T12:00:00.000Z',
                }),
                firstEventAt: z.iso.datetime().nullable().openapi({
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
              })
              .openapi({
                description: 'Project data associated with the provided API key.',
              }),
          }),
        },
      },
    },
    404: errorResponses.projectNotFound,
    ...commonErrorResponses,
  },
});

export function registerProjectRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(projectsListRoute, async ({ json, var: { apiKey } }) => {
    return json(listProjects(await listApiKeyProjects(apiKey)), 200);
  });

  api.openapi(projectRoute, ({ json, var: vars }) => {
    return json(getProject(vars), 200);
  });
}
