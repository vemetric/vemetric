# Vemetric Public API v1 — Implementation Plan (As Built)

## Status

- Status: Implemented and production-ready for v1 foundation
- Last updated: 2026-02-07
- Scope delivered:
  - API key management (create/list/revoke) for org admins
  - Public API auth, logging, rate limiting, error handling, OpenAPI spec
  - First meaningful endpoint: `GET /api/v1/project`
  - External docs redirect (`/api/docs` -> `https://vemetric.com/docs/api`)

---

## Overview

Public API v1 is implemented with:

- Project-scoped API keys
- Flat URL structure (`/api/v1/...`)
- Read-only API surface
- Hono + Zod OpenAPI
- Redis-based per-project rate limiting
- Dedicated API logger (`vemetric-api`) for Axiom separation
- OpenAPI JSON endpoint for docs generation

Current first endpoint is `GET /api/v1/project` (replacing the original ping placeholder).

---

## Phase 1: Infrastructure (Implemented)

### 1.1 Database Schema — API Keys (Prisma)

Implemented in `packages/database/prisma/schema.prisma`:

- `ApiKey` model with:
  - `id`, `projectId`, `name`, `keyHash`, `keyPrefix`, `createdAt`, `revokedAt`
  - `createdByUserId`, `revokedByUserId`
  - relations: `project`, `createdBy`, `revokedBy`
- `Project.apiKeys` relation
- indexes:
  - `@@index([projectId])`
  - `@@index([keyHash, revokedAt])`
  - `@@index([createdByUserId])`
  - `@@index([revokedByUserId])`

Key format in use:

- `vem_` + 32 chars (`[a-z0-9]`) => total length 36

### 1.2 API Key Management (tRPC)

Implemented in `apps/app/src/backend/routes/api-keys.ts` and `packages/database/src/models/api-key.ts`.

- Access control:
  - Uses `projectAdminProcedure` (org admin required)
- `create`:
  - Generates key (`vem_...`)
  - Stores SHA-256 hash only (`keyHash`)
  - Returns raw key once
  - Persists `createdByUserId`
  - Tracks analytics event: `ApiKeyCreated`
- `list`:
  - Returns both active and revoked keys
  - Includes `createdBy` and `revokedBy` user identity fields (id, name, email, image)
- `revoke`:
  - Soft revokes via `updateMany` with guard (`revokedAt: null`)
  - Persists `revokedByUserId`
  - Tracks analytics event: `ApiKeyRevoked`

### 1.3 API Key UI

Implemented in `apps/app/src/frontend/components/pages/settings/project/api-tab.tsx`.

- Admin-only API tab in project settings
- Create key form + one-time raw key modal
- Key list with active/revoked state
- Revoked keys shown via subtle toggle
- Created/revoked metadata shown in tooltips on status badge
- `createdBy` / `revokedBy` displayed with avatar + identity component
- Docs button linking to `https://vemetric.com/docs/api`
- Uses inferred tRPC type (`ApiKeyItem`) from `apps/app/src/frontend/utils/trpc.ts`

---

## Phase 2: Public API Setup (Implemented)

### 2.1 Mount Point

Mounted in app backend:

- `app.route('/api', createPublicApi())`

### 2.2 File Structure

```
apps/app/src/backend/api/
├── index.ts
├── middleware/
│   ├── auth.ts
│   ├── logging.ts
│   └── rate-limit.ts
├── routes/
│   └── projects.ts
├── schemas/
│   └── common.ts
├── utils/
│   ├── api-logger.ts
│   └── errors.ts
└── types.ts
```

Tests are colocated with implementation files:

- `middleware/auth.test.ts`
- `middleware/rate-limit.test.ts`
- `routes/projects.test.ts`

### 2.3 Main App Setup

Implemented behavior in `apps/app/src/backend/api/index.ts`:

- OpenAPI JSON served at `/api/openapi.json`
- `/api/docs` redirects to `https://vemetric.com/docs/api`
- Middleware order for `/v1/*`:
  1. `loggingMiddleware`
  2. `authMiddleware`
  3. `createRateLimitMiddleware()`
- Route mount:
  - `api.route('/v1', projectRoutes)`
- Validation failures return standardized 422 using `defaultHook`
- `notFound` returns docs hint in message

### 2.4 Auth Middleware

Implemented in `apps/app/src/backend/api/middleware/auth.ts`.

- Requires `Authorization: Bearer <key>`
- Validates format before hashing:
  - non-empty
  - exact length 36
  - `vem_` prefix
- Hashes with SHA-256 and looks up non-revoked key
- Sets `apiKey` + `project` in context

### 2.5 Logging Middleware

Implemented in `apps/app/src/backend/api/middleware/logging.ts`.

- Dedicated API logger namespace: `vemetric-api`
- Logs request/response including failed requests
- Logs fields: method, path, status, latency, apiKeyId, projectId
- Does **not** log raw API keys

### 2.6 Rate Limiting

Implemented in `apps/app/src/backend/api/middleware/rate-limit.ts`.

- Per-project Redis key: `ratelimit:api:{projectId}`
- Uses atomic Lua script (`INCR` + `EXPIRE` + `TTL`) via `eval`
- Emits `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Defaults:
  - `limit = 1000`
  - `windowSec = 60`
- Middleware is configurable for tests and future flexibility:
  - `createRateLimitMiddleware({ limit?, windowSec? })`

Redis client implementation:

- Shared reusable client in `apps/app/src/backend/utils/redis.ts`
- Uses `redis` package (not ioredis)
- URL fallback: `process.env.REDIS_URL || redis://localhost:6379`
- Hard-fails requests if Redis is unavailable (rate limiting is required)

---

## Phase 3: First Endpoint (Implemented)

### 3.1 `GET /v1/project`

Implemented in `apps/app/src/backend/api/routes/projects.ts`.

Response:

- `project.id`
- `project.name`
- `project.domain`
- `project.token`
- `project.createdAt` (ISO)
- `project.firstEventAt` (ISO | null)
- `project.hasPublicDashboard`
- `project.excludedIps` (`string[]`)
- `project.excludedCountries` (`string[]`)

OpenAPI includes:

- field-level descriptions
- field-level examples
- shared error responses: 401, 422, 429, 500

---

## Phase 4: Error Handling (Implemented)

Implemented in:

- `apps/app/src/backend/api/utils/errors.ts`
- `apps/app/src/backend/api/schemas/common.ts`

Features:

- `ApiError` class for typed API errors
- unified error handler (`errorHandler`)
- shared validation formatter (`createValidationErrorResponse`)
- shared OpenAPI error schemas (`errorResponseSchema`, `validationErrorResponseSchema`)
- reusable OpenAPI response map (`commonOpenApiErrorResponses`)

---

## Phase 5: Testing & Docs (Implemented)

### 5.1 Automated Tests

Implemented tests:

- Auth middleware:
  - missing header
  - malformed header
  - invalid format
  - overlong key
  - invalid/revoked key
  - valid key
- Rate limiting middleware:
  - under-limit behavior + headers
  - over-limit 429
  - Redis unavailable hard-fail path
- Project route:
  - returns expected project payload for valid key

### 5.2 Manual Checklist

- [ ] Create API key in UI, copy raw key
- [ ] `GET /api/v1/project` with key → returns project info
- [ ] `GET /api/v1/project` without key → 401
- [ ] `GET /api/v1/project` with revoked key → 401
- [ ] Rate limit test → 429 after 1000 requests/minute
- [ ] Verify `X-RateLimit-*` headers on all responses
- [ ] Check Axiom logs for API requests
- [ ] Revoke key, verify subsequent requests return 401

### 5.3 Cloudflare Routing Draft

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

## Key Decisions (Current)

| Decision             | Choice                          | Rationale                                       |
| -------------------- | ------------------------------- | ----------------------------------------------- |
| First endpoint       | `GET /v1/project`               | meaningful smoke test + useful metadata         |
| Docs in app          | No Swagger UI                   | external docs site generated from OpenAPI       |
| Docs endpoint        | `/api/docs` redirect            | single docs source of truth                     |
| Auth key validation  | strict format check before hash | avoids expensive hash on malformed large inputs |
| Rate limit storage   | Redis via shared backend client | reusable and aligned with monorepo approach     |
| Rate limit algorithm | atomic Lua eval                 | avoids INCR/EXPIRE race                         |
| Logger separation    | `vemetric-api` logger           | clearer observability split from backend        |
| API key history      | soft revoke + by whom fields    | auditability without hard deletion              |

---

## Follow-up Work (Not in v1)

- Stats routes (`/v1/stats/*`) — see `PUBLIC-API-STATS-PLAN.md`
- API usage metrics dashboard
- Optional per-key scopes and per-key rate limits
- Event ingestion endpoints
- SDK generation + release flow from OpenAPI
