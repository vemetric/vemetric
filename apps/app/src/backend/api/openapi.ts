import type { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import type { PublicApiHonoEnv } from './types';
import { RETENTION_UPGRADE_MESSAGE } from '../utils/retention';
import { PROJECT_HEADER } from './utils/api-key-access';
import { API_ERROR_CODES, type ApiErrorCode, createErrorBody } from './utils/errors';

export const API_DOCS_URL = 'https://vemetric.com/docs/api/getting-started';
export const API_CHANGELOG_URL = 'https://vemetric.com/changelog';

const API_DESCRIPTION = `Privacy-first analytics API. Query the analytics, users, events and funnels of a Vemetric project.

## Authentication

Authenticate every request with an API key as a bearer token: \`Authorization: Bearer vem_...\`. There are two kinds of keys:

- **Project keys** are created in the project settings, on the API tab, and only grant access to their own project.
- **Organization keys** are created in the organization settings, on the API tab, and grant access to all current
  and future projects of the organization, or to the projects chosen when the key was created.

Organization keys must name the project of every request in the \`${PROJECT_HEADER}\` header (the project ID, see
\`GET /v1/projects\`), even if they currently cover only one project. Without it the API responds with \`400\`
(\`PROJECT_REQUIRED\`). Project keys don't need the header; if it is sent, it must be the key's project.
A project the key doesn't cover returns \`404\` (\`PROJECT_NOT_FOUND\`).

## Errors

Errors return a JSON body of the form \`{ "error": { "code": "...", "message": "..." } }\`.
\`code\` is a stable, machine-readable value (see the \`Error\` schema); \`message\` is meant for humans and may change.
Validation errors (\`VALIDATION_ERROR\`) additionally contain a \`details\` array with one entry per invalid field.

## Rate limits

Each project can make 100 requests per 60 seconds, shared by all keys that access it.
Requests that don't target a project (\`GET /v1/projects\`) count against a separate quota of the key. Every authenticated response carries
\`RateLimit-Limit\`, \`RateLimit-Remaining\` and \`RateLimit-Reset\` (seconds until the window resets) headers.
When the limit is exceeded the API responds with \`429\` and a \`Retry-After\` header (in seconds).
Every response, including \`401\`, carries a \`RateLimit-Policy\` header describing the quota (e.g. \`100;w=60\`).

## Versioning & Deprecation

The API is versioned in the URL path (\`/v1\`). Breaking changes only ship in a new major version;
additive changes (new endpoints, new optional request fields, new response fields) can ship at any time.
Deprecated endpoints are marked as \`deprecated\` in this spec, announced in the changelog (${API_CHANGELOG_URL})
and send \`Deprecation\` and \`Sunset\` headers, plus a \`Link\` header with \`rel="deprecation"\`,
at least 3 months before they are removed.`;

const errorDetailsSchema = z
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
  .openapi({
    description: 'Per-field validation issues. Only present for `VALIDATION_ERROR`.',
  });

const errorMessageSchema = z.string().openapi({
  description: 'Human-readable error message.',
});

/** The union of all errors the API can return. Each error response documents a narrowed version of it. */
export const apiErrorSchema = z
  .object({
    code: z.enum(API_ERROR_CODES).openapi({
      description: 'Machine-readable error code.',
    }),
    message: errorMessageSchema,
    details: errorDetailsSchema.optional(),
  })
  .openapi('Error', { description: 'Error details.' });

export const apiErrorResponseSchema = z
  .object({
    error: apiErrorSchema,
  })
  .openapi('ErrorResponse', { description: 'Error response payload. Any error the API returns has this shape.' });

/** An error response body whose `code` is narrowed to the codes one response can return. */
function narrowedErrorResponseSchema(
  codes: readonly [ApiErrorCode, ...ApiErrorCode[]],
  { codeDescription, withDetails = false }: { codeDescription?: string; withDetails?: boolean } = {},
) {
  return z
    .object({
      error: z
        .object({
          code: z.enum(codes).openapi({ description: codeDescription ?? 'Machine-readable error code.' }),
          message: errorMessageSchema,
          ...(withDetails ? { details: errorDetailsSchema.optional() } : {}),
        })
        .openapi({ description: 'Error details.' }),
    })
    .openapi({ description: 'Error response payload.' });
}

const ref = (type: 'responses' | 'headers', name: string) => ({ $ref: `#/components/${type}/${name}` });

// Each error response has its own schema (narrowed to the codes it returns) and example,
// so docs show the exact code of each status instead of every possible code.
const ERROR_RESPONSES = {
  BadRequest: {
    description: `Bad request - invalid request payload or parameters, or an organization key without the ${PROJECT_HEADER} header`,
    schemaName: 'ValidationError',
    schema: narrowedErrorResponseSchema(['VALIDATION_ERROR', 'HTTP_ERROR', 'PROJECT_REQUIRED'], {
      codeDescription: `Machine-readable error code. \`HTTP_ERROR\` is returned for a malformed JSON body, \`PROJECT_REQUIRED\` for an organization key without the ${PROJECT_HEADER} header.`,
      withDetails: true,
    }),
    example: {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: [{ field: 'dateRange', message: 'Invalid input' }],
      },
    },
  },
  Unauthorized: {
    description: 'Unauthorized - missing, malformed, invalid or revoked API key',
    schemaName: 'UnauthorizedError',
    schema: narrowedErrorResponseSchema(['UNAUTHORIZED']),
    example: createErrorBody('UNAUTHORIZED', 'Invalid or revoked API key'),
  },
  Forbidden: {
    description: 'Requested date range is not allowed for the current plan',
    schemaName: 'PlanLimitExceededError',
    schema: narrowedErrorResponseSchema(['PLAN_LIMIT_EXCEEDED']),
    example: createErrorBody('PLAN_LIMIT_EXCEEDED', RETENTION_UPGRADE_MESSAGE),
  },
  ProjectNotFound: {
    description: 'Project was not found or is not covered by the API key',
    schemaName: 'ProjectNotFoundError',
    schema: narrowedErrorResponseSchema(['PROJECT_NOT_FOUND']),
    example: createErrorBody('PROJECT_NOT_FOUND', 'Project not found or not covered by this API key'),
  },
  UserNotFound: {
    description: 'User or project was not found',
    schemaName: 'UserNotFoundError',
    schema: narrowedErrorResponseSchema(['USER_NOT_FOUND', 'PROJECT_NOT_FOUND']),
    example: createErrorBody('USER_NOT_FOUND', 'User not found'),
  },
  FunnelNotFound: {
    description: 'Funnel or project was not found',
    schemaName: 'FunnelNotFoundError',
    schema: narrowedErrorResponseSchema(['FUNNEL_NOT_FOUND', 'PROJECT_NOT_FOUND']),
    example: createErrorBody('FUNNEL_NOT_FOUND', 'Funnel not found'),
  },
  RateLimited: {
    description: 'Rate limit exceeded - retry after the number of seconds in the Retry-After header',
    schemaName: 'RateLimitExceededError',
    schema: narrowedErrorResponseSchema(['RATE_LIMIT_EXCEEDED']),
    example: createErrorBody('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded. Try again shortly.'),
  },
  InternalError: {
    description: 'Unexpected internal error',
    schemaName: 'InternalError',
    schema: narrowedErrorResponseSchema(['INTERNAL_ERROR']),
    example: createErrorBody('INTERNAL_ERROR', 'An unexpected error occurred'),
  },
} as const;

const RATE_LIMIT_HEADERS = {
  'RateLimit-Limit': 'Maximum number of requests allowed in the current window.',
  'RateLimit-Remaining': 'Number of requests remaining in the current window.',
  'RateLimit-Reset': 'Number of seconds until the current window resets.',
} as const;

const rateLimitPolicyHeader = { 'RateLimit-Policy': ref('headers', 'RateLimit-Policy') };

export const rateLimitResponseHeaders = {
  ...Object.fromEntries(Object.keys(RATE_LIMIT_HEADERS).map((name) => [name, ref('headers', name)])),
  ...rateLimitPolicyHeader,
};

export const errorResponses = {
  badRequest: ref('responses', 'BadRequest'),
  unauthorized: ref('responses', 'Unauthorized'),
  forbidden: ref('responses', 'Forbidden'),
  projectNotFound: ref('responses', 'ProjectNotFound'),
  userNotFound: ref('responses', 'UserNotFound'),
  funnelNotFound: ref('responses', 'FunnelNotFound'),
  rateLimited: ref('responses', 'RateLimited'),
  internalError: ref('responses', 'InternalError'),
} as const;

const projectHeaderSchema = z
  .string()
  .optional()
  .openapi('ProjectHeader', {
    param: { name: PROJECT_HEADER, in: 'header' },
    description:
      "ID of the project the request is about. Required for organization keys; optional for project keys (must be the key's project if sent).",
    example: '1234567890123456',
  });

/** The `X-Vemetric-Project` header of every endpoint that is about one project. */
export const projectRequestHeaders = z.object({
  // Documentation only: `projectMiddleware` reads and checks the header (Hono passes header keys in lower case
  // to the validator, so this optional field never sees the value).
  [PROJECT_HEADER]: projectHeaderSchema,
});

/** Error responses every authenticated endpoint can return. */
export const commonErrorResponses = {
  400: errorResponses.badRequest,
  401: errorResponses.unauthorized,
  429: errorResponses.rateLimited,
  500: errorResponses.internalError,
} as const;

export function registerOpenApiDocs(api: OpenAPIHono<PublicApiHonoEnv>) {
  const registry = api.openAPIRegistry;

  registry.register('ErrorResponse', apiErrorResponseSchema);
  registry.registerParameter('ProjectHeader', projectHeaderSchema);

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description:
      'Project or organization API key (starts with `vem_`), created in the project or organization settings on the API tab. Organization keys name the project of each request in the `X-Vemetric-Project` header.',
  });

  for (const [name, description] of Object.entries(RATE_LIMIT_HEADERS)) {
    registry.registerComponent('headers', name, {
      description,
      schema: { type: 'integer', minimum: 0 },
    });
  }
  registry.registerComponent('headers', 'RateLimit-Policy', {
    description: 'Rate-limit quota as `<limit>;w=<window in seconds>`. Sent on every response, including 401.',
    schema: { type: 'string', example: '100;w=60' },
  });
  registry.registerComponent('headers', 'Retry-After', {
    description: 'Number of seconds to wait before making a new request.',
    schema: { type: 'integer', minimum: 0 },
  });

  for (const [name, { description, schemaName, schema, example }] of Object.entries(ERROR_RESPONSES)) {
    registry.register(schemaName, schema);
    registry.registerComponent('responses', name, {
      description,
      headers:
        name === 'RateLimited'
          ? { ...rateLimitResponseHeaders, 'Retry-After': ref('headers', 'Retry-After') }
          : name === 'Unauthorized'
            ? rateLimitPolicyHeader
            : undefined,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${schemaName}` },
          example,
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
      { name: 'Project', description: 'The projects the API key covers.' },
      { name: 'Analytics', description: 'Aggregated analytics metrics.' },
      { name: 'Filters', description: 'Values available for filtering.' },
      { name: 'Users', description: 'Tracked users and their events.' },
      { name: 'Funnels', description: 'Funnels and their results.' },
    ],
  });
}
