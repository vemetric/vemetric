# Vemetric Public API — Stats Routes Plan

## Status

- Status: Draft (next phase)
- Last updated: 2026-02-07
- Depends on: implemented Public API v1 foundation in `PUBLIC-API-PLAN.md`

---

## Foundation Already Implemented

The following is already in place and should be reused:

- Auth middleware (`Authorization: Bearer <apiKey>`) with strict format validation
- Per-project context (`c.get('project')`)
- Redis rate limiting middleware
- Request logging middleware (`vemetric-api` logger)
- Shared error handling + validation hook
- Shared OpenAPI error responses (`commonOpenApiErrorResponses`)
- OpenAPI spec endpoint: `/api/openapi.json`
- Docs endpoint behavior: `/api/docs` redirects to `https://vemetric.com/docs/api`

Current v1 route (already live candidate):

- `GET /api/v1/project`

---

## Goals

Add read-only stats endpoints under `/api/v1/stats/*` using existing ClickHouse query primitives.

Target routes:

- `GET /v1/stats/aggregate`
- `GET /v1/stats/timeseries`
- `GET /v1/stats/breakdown`

---

## Route Design

### 1) `GET /v1/stats/aggregate`

Returns aggregate KPIs over a period.

Query parameters (draft):

- `period`: `today | 7d | 30d | 90d | 12m | all` (default `30d`)
- `start`: ISO datetime (optional)
- `end`: ISO datetime (optional)
- `metrics`: comma-separated metric names (optional)
- `filters`: JSON-encoded filter config (optional)

Response (draft):

- `visitors?: number`
- `pageviews?: number`
- `events?: number`
- `bounceRate?: number`
- `avgSessionDuration?: number`

### 2) `GET /v1/stats/timeseries`

Returns metric values over time.

Query parameters (draft):

- `period`: same as above
- `start`, `end`: optional ISO datetime
- `metric`: `visitors | pageviews | events` (default `visitors`)
- `granularity`: `hour | day | week | month` (default `day`)
- `filters`: JSON-encoded filter config (optional)

Response (draft):

- `data: Array<{ timestamp: string; value: number }>`

### 3) `GET /v1/stats/breakdown`

Returns grouped breakdowns by selected property.

Query parameters (draft):

- `period`: same as above
- `start`, `end`: optional ISO datetime
- `property`: enum (page, referrer, source, utm_*, geo, browser/os/device)
- `metric`: `visitors | pageviews | events` (default `visitors`)
- `limit`: `1..100` (default `10`)
- `filters`: JSON-encoded filter config (optional)

Response (draft):

- `data: Array<{ value: string; count: number; percentage: number }>`

---

## Implementation Notes

### File layout

Use colocated route module(s) under:

- `apps/app/src/backend/api/routes/`

Recommended:

- `stats.ts` (single module initially)
- expand later if needed (`stats/aggregate.ts`, etc.)

### OpenAPI patterns

Reuse existing patterns from `routes/projects.ts`:

- `createRoute(...)` with typed query schemas
- route-level summaries/descriptions/examples
- spread `...commonOpenApiErrorResponses` into each route’s responses

### Error contracts

Document and return:

- `401` unauthorized
- `422` validation error
- `429` rate limit exceeded
- `500` internal error

### Filter parsing

`filters` should remain compatible with dashboard filter format.

- Parse safely (with validation + friendly 422 on malformed JSON)
- Avoid passing unvalidated raw JSON deeper into query layer

---

## Testing Plan

Add colocated tests (same pattern as current API tests):

- `apps/app/src/backend/api/routes/stats.test.ts`

Minimum coverage:

- aggregate route success + 422 query validation failure
- timeseries route success + granularity handling
- breakdown route success + property validation
- auth and rate-limits remain enforced by mounted middleware stack

---

## Rollout Plan

1. Implement aggregate route only (smallest valuable scope)
2. Publish updated OpenAPI
3. Generate/update external docs from OpenAPI
4. Add timeseries + breakdown in follow-up

This keeps incremental shipping speed while preserving a stable contract.
