import type { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import type { PublicApiHonoEnv } from './types';
import { API_ERROR_CODES } from './utils/errors';

export const API_DOCS_URL = 'https://vemetric.com/docs/api/getting-started';
export const API_CHANGELOG_URL = 'https://vemetric.com/changelog';

const API_DESCRIPTION = `Privacy-first analytics API. Query the analytics, users, events and funnels of a Vemetric project.

## Authentication

Authenticate every request with a project API key as a bearer token: \`Authorization: Bearer vem_...\`.
API keys are created in the project settings, on the API tab. A key only grants access to its own project.

## Errors

Errors return a JSON body of the form \`{ "error": { "code": "...", "message": "..." } }\`.
\`code\` is a stable, machine-readable value (see the \`Error\` schema); \`message\` is meant for humans and may change.
Validation errors (\`VALIDATION_ERROR\`) additionally contain a \`details\` array with one entry per invalid field.

## Rate limits

Each project can make 100 requests per 60 seconds. Every authenticated response carries
\`RateLimit-Limit\`, \`RateLimit-Remaining\` and \`RateLimit-Reset\` (seconds until the window resets) headers.
When the limit is exceeded the API responds with \`429\` and a \`Retry-After\` header (in seconds).

## Versioning & Deprecation

The API is versioned in the URL path (\`/v1\`). Breaking changes only ship in a new major version;
additive changes (new endpoints, new optional request fields, new response fields) can ship at any time.
Deprecated endpoints are marked as \`deprecated\` in this spec, announced in the changelog (${API_CHANGELOG_URL})
and send \`Deprecation\` and \`Sunset\` headers, plus a \`Link\` header with \`rel="deprecation"\`,
at least 3 months before they are removed.`;

export const apiErrorSchema = z
  .object({
    code: z.enum(API_ERROR_CODES).openapi({
      description: 'Machine-readable error code.',
      example: 'UNAUTHORIZED',
    }),
    message: z.string().openapi({
      description: 'Human-readable error message.',
      example: 'Invalid or revoked API key',
    }),
    details: z
      .array(
        z.object({
          field: z.string().openapi({
            description: 'Path to the invalid request field.',
            example: 'groupBy.0',
          }),
          message: z.string().openapi({
            description: 'Validation error message for the field.',
          }),
        }),
      )
      .optional()
      .openapi({
        description: 'Per-field validation issues. Only present for `VALIDATION_ERROR`.',
      }),
  })
  .openapi('Error', { description: 'Error details.' });

export const apiErrorResponseSchema = z
  .object({
    error: apiErrorSchema,
  })
  .openapi('ErrorResponse', { description: 'Error response payload.' });

const ref = (type: 'responses' | 'headers', name: string) => ({ $ref: `#/components/${type}/${name}` });

const ERROR_RESPONSES = {
  BadRequest: 'Bad request - invalid request payload or parameters. Code: `VALIDATION_ERROR`.',
  Unauthorized: 'Unauthorized - missing, malformed, invalid or revoked API key. Code: `UNAUTHORIZED`.',
  Forbidden: 'Forbidden - the request is not allowed for the current plan. Code: `PLAN_LIMIT_EXCEEDED`.',
  NotFound:
    'Not found - the requested resource does not exist. Codes: `NOT_FOUND`, `USER_NOT_FOUND`, `FUNNEL_NOT_FOUND`.',
  RateLimited:
    'Rate limit exceeded. Wait for the number of seconds given in `Retry-After`. Code: `RATE_LIMIT_EXCEEDED`.',
  InternalError: 'Unexpected internal error. Code: `INTERNAL_ERROR`.',
} as const;

const RATE_LIMIT_HEADERS = {
  'RateLimit-Limit': 'Maximum number of requests allowed in the current window.',
  'RateLimit-Remaining': 'Number of requests remaining in the current window.',
  'RateLimit-Reset': 'Number of seconds until the current window resets.',
} as const;

export const rateLimitResponseHeaders = Object.fromEntries(
  Object.keys(RATE_LIMIT_HEADERS).map((name) => [name, ref('headers', name)]),
);

export const errorResponses = {
  400: ref('responses', 'BadRequest'),
  401: ref('responses', 'Unauthorized'),
  403: ref('responses', 'Forbidden'),
  404: ref('responses', 'NotFound'),
  429: ref('responses', 'RateLimited'),
  500: ref('responses', 'InternalError'),
} as const;

/** Error responses every authenticated endpoint can return. */
export const commonErrorResponses = {
  400: errorResponses[400],
  401: errorResponses[401],
  429: errorResponses[429],
  500: errorResponses[500],
} as const;

export function registerOpenApiDocs(api: OpenAPIHono<PublicApiHonoEnv>) {
  const registry = api.openAPIRegistry;

  registry.register('ErrorResponse', apiErrorResponseSchema);

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'Project API key, created in the project settings on the API tab. Example: `vem_...`.',
  });

  for (const [name, description] of Object.entries(RATE_LIMIT_HEADERS)) {
    registry.registerComponent('headers', name, {
      description,
      schema: { type: 'integer', minimum: 0 },
    });
  }
  registry.registerComponent('headers', 'Retry-After', {
    description: 'Number of seconds to wait before making a new request.',
    schema: { type: 'integer', minimum: 0 },
  });

  for (const [name, description] of Object.entries(ERROR_RESPONSES)) {
    registry.registerComponent('responses', name, {
      description,
      headers:
        name === 'RateLimited'
          ? { ...rateLimitResponseHeaders, 'Retry-After': ref('headers', 'Retry-After') }
          : undefined,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    });
  }

  api.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Vemetric API',
      version: '1.0.0',
      description: API_DESCRIPTION,
      contact: {
        name: 'Vemetric',
        email: 'info@vemetric.com',
        url: 'https://vemetric.com',
      },
    },
    externalDocs: {
      description: 'Vemetric API documentation',
      url: API_DOCS_URL,
    },
    servers: [{ url: 'https://api.vemetric.com' }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Project', description: 'The project the API key belongs to.' },
      { name: 'Analytics', description: 'Aggregated analytics metrics.' },
      { name: 'Filters', description: 'Values available for filtering.' },
      { name: 'Users', description: 'Tracked users and their events.' },
      { name: 'Funnels', description: 'Funnels and their results.' },
    ],
  });
}
