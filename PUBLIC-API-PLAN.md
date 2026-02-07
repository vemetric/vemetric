# Vemetric Public API v1 — Implementation Plan

---

## Overview

Build the first version of Vemetric's public API with:

- Project-scoped API keys
- Flat URL structure (`/api/v1/...`, not `/api/v1/projects/{id}/...`)
- Read-only in v1 — starting with ping route, stats routes to follow (see `PUBLIC-API-STATS-PLAN.md`)
- Hono + Zod OpenAPI for type-safe routes with auto-generated docs (https://hono.dev/examples/zod-openapi)
- Redis-based rate limiting per project
- Axiom request logging via existing Pino setup
- Available on all plans (including free)

---

## Phase 1: Infrastructure

### 1.1 Database Schema — API Keys (Prisma)

Add to `packages/database/prisma/schema.prisma`:

```prisma
model ApiKey {
  id        String    @id              // 'key_' + nanoid
  projectId String
  name      String    @db.VarChar      // user-provided label
  keyHash   String    @unique          // SHA-256 hash of the full key
  keyPrefix String    @db.VarChar      // first 12 chars for display (e.g., 'vem_a1b2c3d4...')
  createdAt DateTime  @default(now())
  revokedAt DateTime?                  // soft delete

  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}
```

Also add to the `Project` model:

```prisma
model Project {
  // ... existing fields ...
  apiKeys ApiKey[]
}
```

**Key format:** `vem_` + 32 random chars (36 total, e.g., `vem_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

Run `bunx prisma migrate dev --name add_api_keys` after adding the model.

### 1.2 API Key Management (tRPC routes)

Add to existing tRPC router in `apps/app/src/backend/routes/` as a new `apiKeys.ts` router. Uses `projectProcedure` + an additional admin role check on the parent organization — only org admins can view and manage API keys.

First, add `projectAdminProcedure` to `apps/app/src/backend/utils/trpc.ts` alongside the existing procedures:

```typescript
// apps/app/src/backend/utils/trpc.ts (add after projectProcedure)
export const projectAdminProcedure = projectProcedure.use(async (opts) => {
  const { ctx } = opts;
  const isAdmin = await dbOrganization.hasUserAccess(
    ctx.project.organizationId,
    ctx.user.id,
    OrganizationRole.ADMIN,
  );
  if (!isAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only organization admins can perform this action' });
  }
  return opts.next();
});
```

Then use it in the api-keys router:

```typescript
// apps/app/src/backend/routes/api-keys.ts
import { router, projectAdminProcedure } from '../utils/trpc';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const apiKeysRouter = router({
  create: projectAdminProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const rawKey = `vem_${nanoid(32)}`;
      const keyHash = sha256(rawKey);
      const keyPrefix = rawKey.slice(0, 12) + '...';

      await prismaClient.apiKey.create({
        data: {
          id: `key_${nanoid()}`,
          projectId: ctx.projectId,
          name: input.name,
          keyHash,
          keyPrefix,
        },
      });

      // Return raw key ONCE — never stored/retrievable again
      return { rawKey, keyPrefix };
    }),

  list: projectAdminProcedure.query(async ({ ctx }) => {
    return prismaClient.apiKey.findMany({
      where: { projectId: ctx.projectId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  revoke: projectAdminProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prismaClient.apiKey.update({
        where: { id: input.keyId, projectId: ctx.projectId },
        data: { revokedAt: new Date() },
      });
    }),
});
```

Register in the main tRPC router:

```typescript
export const trpcRouter = router({
  // ... existing routes ...
  apiKeys: apiKeysRouter,
});
```

### 1.3 API Key UI

Add a new "API" tab in project settings (admin-only):

- [ ] New "API" tab in project settings — only visible to org admins
- [ ] Create key form (name input)
- [ ] Show raw key once in modal with copy button + "you won't see this again" warning
- [ ] List existing keys (prefix, name, created)
- [ ] Revoke button with confirmation dialog

---

## Phase 2: Hono API Setup

### 2.1 Mount Point

The public API mounts in the existing app server at `apps/app/src/backend/index.ts`, replacing the current `/api*` 501 placeholder:

```typescript
// apps/app/src/backend/index.ts
import { createPublicApi } from './api';

// Replace the existing:
//   app.all('/api*', (c) => c.json({ error: 'Not implemented' }, 501));
// With:
app.route('/api', createPublicApi());
```

### 2.2 File Structure

```
apps/app/src/backend/
├── api/
│   ├── index.ts              # createPublicApi() — mounts routes + middleware
│   ├── middleware/
│   │   ├── auth.ts           # API key validation
│   │   ├── logging.ts        # Axiom request logging
│   │   └── rate-limit.ts     # Redis-based rate limiting
│   ├── routes/
│   │   └── ping.ts           # GET /v1/ping
│   └── schemas/
│       └── common.ts         # Shared schemas (error responses)
├── backend-app.ts            # Existing tRPC app (unchanged)
└── ...
```

### 2.3 Main App Setup

```typescript
// apps/app/src/backend/api/index.ts
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { authMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { pingRoute } from './routes/ping';

export function createPublicApi() {
  const api = new OpenAPIHono();

  // Docs — mounted outside /v1/* so no auth required
  api.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Vemetric API',
      version: '1.0.0',
      description: 'Privacy-first analytics API (read-only)',
    },
  });
  api.get('/docs', swaggerUI({ url: '/api/openapi.json' }));

  // Middleware stack for /v1/* (order matters)
  api.use('/v1/*', loggingMiddleware);    // 1. Log request + response to Axiom
  api.use('/v1/*', authMiddleware);       // 2. Authenticate (resolve API key + project)
  api.use('/v1/*', rateLimitMiddleware);  // 3. Rate limit (by API key, needs auth first)

  // Routes
  api.route('/v1', pingRoute);

  // Global error handler
  api.onError(errorHandler);

  return api;
}
```

### 2.4 Auth Middleware

```typescript
// apps/app/src/backend/api/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { createHash } from 'crypto';
import { prismaClient } from '@vemetric/database';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing API key. Use Authorization: Bearer <key>' });
  }

  const rawKey = authHeader.slice(7); // 'Bearer '.length
  const keyHash = sha256(rawKey);

  const apiKey = await prismaClient.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    include: { project: true },
  });

  if (!apiKey) {
    throw new HTTPException(401, { message: 'Invalid or revoked API key' });
  }

  c.set('apiKey', apiKey);
  c.set('project', apiKey.project);

  await next();
});
```

### 2.5 Logging Middleware (Axiom)

Logs every API request to Axiom for usage monitoring. Runs before auth so failed auth attempts are also captured.

```typescript
// apps/app/src/backend/api/middleware/logging.ts
import { createMiddleware } from 'hono/factory';
import { logger } from '../../utils/logger';

export const loggingMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();

  await next();

  const apiKey = c.get('apiKey');

  logger.info({
    type: 'api.request',
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    latencyMs: Date.now() - start,
    apiKeyId: apiKey?.id,
    projectId: apiKey?.projectId,
  });
});
```

### 2.6 Rate Limiting (Redis)

```typescript
// apps/app/src/backend/api/middleware/rate-limit.ts
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const LIMIT = 1000;       // requests per window
const WINDOW_SEC = 60;    // 1 minute

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const project = c.get('project');
  if (!project) return next();

  const redisKey = `ratelimit:api:${project.id}`;
  const current = await redis.incr(redisKey);

  if (current === 1) {
    await redis.expire(redisKey, WINDOW_SEC);
  }

  const ttl = await redis.ttl(redisKey);
  const remaining = Math.max(0, LIMIT - current);

  // Set rate limit headers on all responses
  await next();

  c.header('X-RateLimit-Limit', String(LIMIT));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + ttl));

  if (current > LIMIT) {
    throw new HTTPException(429, { message: 'Rate limit exceeded. Try again shortly.' });
  }
});
```

---

## Phase 3: First Routes

### 3.1 Ping Route

```typescript
// apps/app/src/backend/api/routes/ping.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const pingRoute = new OpenAPIHono();

const route = createRoute({
  method: 'get',
  path: '/ping',
  summary: 'Health check',
  description: 'Verify API key is valid and see which project it belongs to.',
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
    project: { id: project.id, name: project.name },
  });
});

export { pingRoute };
```

---

## Phase 4: Error Handling

### 4.1 Consistent Error Responses

```typescript
// apps/app/src/backend/api/lib/errors.ts
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';

export class ApiError extends HTTPException {
  constructor(
    status: number,
    public code: string,
    message: string,
  ) {
    super(status, { message });
  }
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status,
    );
  }

  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: 'ERROR', message: err.message } },
      err.status,
    );
  }

  // Unexpected error — log full details, return generic message
  console.error('Unhandled API error:', err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500,
  );
}
```

### 4.2 Zod Validation Errors

Configure OpenAPI to return structured 422 responses for validation failures:

```typescript
// In api/index.ts, configure the OpenAPI app:
const api = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: result.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        422,
      );
    }
  },
});
```

---

## Phase 5: Testing & Docs

### 5.1 Automated Tests (Vitest)

Add tests in `apps/app/src/backend/api/__tests__/`:

- [ ] **Auth middleware tests**: valid key, invalid key, revoked key, missing header, malformed header
- [ ] **Rate limit tests**: under limit passes, over limit returns 429, headers are set correctly
- [ ] **Ping route test**: returns project info with valid key

### 5.2 Manual Testing Checklist

- [ ] Create API key in UI, copy raw key
- [ ] `GET /api/v1/ping` with key → returns project info
- [ ] `GET /api/v1/ping` without key → 401
- [ ] `GET /api/v1/ping` with revoked key → 401
- [ ] Rate limit test → 429 after 1000 requests/minute
- [ ] Verify `X-RateLimit-*` headers on all responses
- [ ] Check Axiom logs for API requests
- [ ] Revoke key, verify subsequent requests return 401

### 5.3 Documentation

- [ ] OpenAPI spec auto-generated at `/api/openapi.json`
- [ ] `/api/docs` redirects to `https://vemetric.com/docs/api`
- [ ] Add markdown docs page to vemetric.com/docs/api
- [ ] Include: Authentication, Rate limits, Endpoints, Filter format, Error codes, Examples

### 5.4 Production Routing (Cloudflare)

Use explicit host-based rules so `api.vemetric.com` is the canonical API domain, while direct use of `app.vemetric.com/api/*` is blocked or redirected. This avoids loops because each rule matches a different incoming host.

1. `api.vemetric.com/*` -> proxy/rewrite to app origin `/api/*`
- Type: Origin/Transform rewrite (or Worker proxy)
- Match expression:
```txt
(http.host eq "api.vemetric.com" and starts_with(http.request.uri.path, "/"))
```
- Action:
  - Forward to origin host `app.vemetric.com`
  - Rewrite path to `/api${http.request.uri.path}`
  - Preserve query string

2. `app.vemetric.com/api/*` -> redirect/block direct access
- Type: Redirect rule (recommended first)
- Match expression:
```txt
(http.host eq "app.vemetric.com" and starts_with(http.request.uri.path, "/api/"))
```
- Action:
  - Status: `308`
  - Destination: `https://api.vemetric.com${substring(http.request.uri.path, 4)}`
  - Preserve query string

Optional stricter variant:
- Allow redirect only for `GET`/`HEAD`, return `404` (or `410`) for other methods to discourage non-canonical writes on app domain.

---

## Implementation Order

1. **Prisma schema + migration** — add `ApiKey` model, run migration
2. **tRPC key management** — create/list/revoke routes
3. **API Key UI** — new "API" tab in project settings
4. **Hono app scaffold** — file structure, mount at `/api`, OpenAPI setup, docs
5. **Auth middleware** — key validation, context setup
6. **Logging middleware** — Axiom request logging
7. **Rate limiting** — Redis-based, per project, with headers
8. **Error handling** — consistent format, Zod validation hook
9. **Ping route** — verify end-to-end flow works
10. **Automated tests** — Vitest suite for middleware + ping route
11. **Docs** — verify Swagger UI, add external docs page

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Mount point | `/api/v1/*` in `apps/app` | Reuse existing server, replace 501 placeholder |
| Scope | Ping route only for now | Stats routes planned separately (`PUBLIC-API-STATS-PLAN.md`) |
| Auth | Bearer token (API key hash lookup) | Simple, stateless, no session needed |
| Rate limiting | Redis fixed window, per project | All keys for a project share one bucket |
| Docs | Swagger UI at `/api/docs` (no auth) | Outside `/v1/*` prefix, publicly accessible |
| Validation errors | Structured 422 with field-level details | Developer-friendly error messages |

---

## Future Enhancements (not v1)

- Stats routes (`GET /v1/stats/aggregate`, `timeseries`, `breakdown`) — see `PUBLIC-API-STATS-PLAN.md`
- Event ingestion via API (`POST /v1/events`, `POST /v1/events/batch`) — reuse hub's BullMQ pipeline
- `POST /v1/query` — flexible query endpoint for AI agents
- User tokens + `X-Vemetric-Project` header (CLI support)
- Webhook subscriptions
- SDK generation from OpenAPI spec
- Per-key scope enforcement (`events:write`, `stats:read`, etc.)
- Per-key custom rate limits
- API usage dashboard (requests over time, by endpoint)

---

_Created: 2026-02-05_
_Updated: 2026-02-05 — Refined to align with existing codebase architecture_
