# Vemetric Public API v1 — Implementation Plan

*For execution with Codex or similar coding agents.*

---

## Overview

Build the first version of Vemetric's public API with:
- Project-scoped API keys
- Flat URL structure (`/v1/events`, not `/v1/projects/{id}/events`)
- Hono + Zod OpenAPI for type-safe routes with auto-generated docs
- Axiom for request logging
- Rate limiting per API key

---

## Phase 1: Infrastructure

### 1.1 Database Schema — API Keys

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,                    -- 'key_' + nanoid
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- user-provided label
  key_hash TEXT NOT NULL,                 -- SHA-256 hash of the full key
  key_prefix TEXT NOT NULL,               -- first 8 chars for display (e.g., 'vem_abc1...')
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP                    -- soft delete
);

CREATE INDEX idx_api_keys_project ON api_keys(project_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

**Key format:** `vem_` + 32 random chars (e.g., `vem_a1b2c3d4e5f6...`)

### 1.2 API Key Management (tRPC or internal routes)

Implement in existing app (not public API):

```typescript
// Create key
async function createApiKey(projectId: string, name: string) {
  const rawKey = `vem_${nanoid(32)}`
  const keyHash = sha256(rawKey)
  const keyPrefix = rawKey.slice(0, 12) + '...'
  
  await db.insert(apiKeys).values({
    id: `key_${nanoid()}`,
    projectId,
    name,
    keyHash,
    keyPrefix,
  })
  
  // Return raw key ONCE — never stored/retrievable again
  return { rawKey, keyPrefix }
}

// List keys (for UI)
async function listApiKeys(projectId: string) {
  return db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    lastUsedAt: apiKeys.lastUsedAt,
    createdAt: apiKeys.createdAt,
  })
  .from(apiKeys)
  .where(eq(apiKeys.projectId, projectId))
  .where(isNull(apiKeys.revokedAt))
}

// Revoke key
async function revokeApiKey(keyId: string) {
  await db.update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId))
}
```

### 1.3 API Key UI

Add to project settings:
- [ ] "API Keys" section
- [ ] Create key form (name input)
- [ ] Show raw key once in modal with copy button + warning
- [ ] List existing keys (prefix, name, last used, created)
- [ ] Revoke button with confirmation

---

## Phase 2: Hono API Setup

### 2.1 File Structure

```
src/
├── api/
│   ├── index.ts              # Main Hono app, mounts routes
│   ├── middleware/
│   │   ├── auth.ts           # API key validation
│   │   ├── rateLimit.ts      # Rate limiting
│   │   └── logging.ts        # Axiom request logging
│   ├── routes/
│   │   ├── ping.ts           # GET /v1/ping
│   │   ├── events.ts         # POST /v1/events, GET /v1/events
│   │   └── stats.ts          # GET /v1/stats/*
│   ├── schemas/
│   │   ├── common.ts         # Shared schemas (error, pagination)
│   │   ├── events.ts         # Event schemas
│   │   └── stats.ts          # Stats schemas
│   └── lib/
│       └── errors.ts         # Error response helpers
```

### 2.2 Main App Setup

```typescript
// src/api/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { authMiddleware } from './middleware/auth'
import { loggingMiddleware } from './middleware/logging'
import { rateLimitMiddleware } from './middleware/rateLimit'
import { pingRoute } from './routes/ping'
import { eventsRoutes } from './routes/events'
import { statsRoutes } from './routes/stats'

const api = new OpenAPIHono()

// Global middleware
api.use('/v1/*', loggingMiddleware)
api.use('/v1/*', authMiddleware)
api.use('/v1/*', rateLimitMiddleware)

// Mount routes
api.route('/v1', pingRoute)
api.route('/v1', eventsRoutes)
api.route('/v1', statsRoutes)

// OpenAPI docs
api.doc('/v1/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Vemetric API',
    version: '1.0.0',
    description: 'Privacy-first analytics API',
  },
})
api.get('/v1/docs', swaggerUI({ url: '/v1/openapi.json' }))

export { api }
```

### 2.3 Auth Middleware

```typescript
// src/api/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

export const authMiddleware = createMiddleware(async (c, next) => {
  // Skip auth for docs
  if (c.req.path.includes('/docs') || c.req.path.includes('/openapi.json')) {
    return next()
  }
  
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing API key' })
  }
  
  const rawKey = authHeader.replace('Bearer ', '')
  const keyHash = sha256(rawKey)
  
  const apiKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.keyHash, keyHash),
      isNull(apiKeys.revokedAt)
    ),
    with: { project: true }
  })
  
  if (!apiKey) {
    throw new HTTPException(401, { message: 'Invalid API key' })
  }
  
  // Update last used (fire and forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id))
    .execute()
  
  // Set context for routes
  c.set('apiKey', apiKey)
  c.set('project', apiKey.project)
  
  await next()
})
```

### 2.4 Logging Middleware (Axiom)

```typescript
// src/api/middleware/logging.ts
import { createMiddleware } from 'hono/factory'

export const loggingMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now()
  
  await next()
  
  const latencyMs = Date.now() - start
  const apiKey = c.get('apiKey')
  
  // Log to Axiom (adjust to your Axiom setup)
  logger.info('api.request', {
    method: c.req.method,
    path: c.req.path,
    statusCode: c.res.status,
    latencyMs,
    apiKeyId: apiKey?.id,
    projectId: apiKey?.projectId,
  })
})
```

### 2.5 Rate Limiting

```typescript
// src/api/middleware/rateLimit.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

// Simple in-memory rate limiter (replace with Redis for production)
const rateLimits = new Map<string, { count: number; resetAt: number }>()

const LIMIT = 1000        // requests per window
const WINDOW_MS = 60_000  // 1 minute

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const apiKey = c.get('apiKey')
  if (!apiKey) return next()
  
  const now = Date.now()
  const key = apiKey.id
  const current = rateLimits.get(key)
  
  if (!current || now > current.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS })
  } else if (current.count >= LIMIT) {
    c.res.headers.set('X-RateLimit-Limit', String(LIMIT))
    c.res.headers.set('X-RateLimit-Remaining', '0')
    c.res.headers.set('X-RateLimit-Reset', String(current.resetAt))
    throw new HTTPException(429, { message: 'Rate limit exceeded' })
  } else {
    current.count++
  }
  
  await next()
  
  const limit = rateLimits.get(key)
  if (limit) {
    c.res.headers.set('X-RateLimit-Limit', String(LIMIT))
    c.res.headers.set('X-RateLimit-Remaining', String(LIMIT - limit.count))
    c.res.headers.set('X-RateLimit-Reset', String(limit.resetAt))
  }
})
```

---

## Phase 3: First Routes

### 3.1 Ping Route (test everything works)

```typescript
// src/api/routes/ping.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const pingRoute = new OpenAPIHono()

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
})

pingRoute.openapi(route, (c) => {
  const project = c.get('project')
  return c.json({
    status: 'ok' as const,
    project: {
      id: project.id,
      name: project.name,
    },
  })
})

export { pingRoute }
```

### 3.2 Events Routes

```typescript
// src/api/routes/events.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const eventsRoutes = new OpenAPIHono()

// --- POST /v1/events (track single event) ---
const trackEventSchema = z.object({
  name: z.string().min(1).max(255),
  userId: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
})

const trackRoute = createRoute({
  method: 'post',
  path: '/events',
  summary: 'Track event',
  request: {
    body: {
      content: {
        'application/json': { schema: trackEventSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Event tracked',
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true) }),
        },
      },
    },
  },
})

eventsRoutes.openapi(trackRoute, async (c) => {
  const project = c.get('project')
  const body = c.req.valid('json')
  
  // Insert event (adapt to your event ingestion logic)
  await trackEvent({
    projectId: project.id,
    name: body.name,
    userId: body.userId,
    properties: body.properties,
    timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
  })
  
  return c.json({ success: true as const })
})

// --- POST /v1/events/batch (track multiple events) ---
const batchSchema = z.object({
  events: z.array(trackEventSchema).min(1).max(100),
})

const batchRoute = createRoute({
  method: 'post',
  path: '/events/batch',
  summary: 'Track multiple events',
  request: {
    body: {
      content: {
        'application/json': { schema: batchSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Events tracked',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            count: z.number(),
          }),
        },
      },
    },
  },
})

eventsRoutes.openapi(batchRoute, async (c) => {
  const project = c.get('project')
  const { events } = c.req.valid('json')
  
  await trackEventsBatch(project.id, events)
  
  return c.json({ success: true as const, count: events.length })
})

export { eventsRoutes }
```

---

## Phase 4: Stats Routes (Read Endpoints)

### 4.1 Common Query Params

```typescript
// src/api/schemas/common.ts
import { z } from '@hono/zod-openapi'

export const dateRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  period: z.enum(['today', '7d', '30d', '90d', '12m', 'all']).optional(),
})

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})
```

### 4.2 Stats Routes

```typescript
// src/api/routes/stats.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { dateRangeSchema } from '../schemas/common'

const statsRoutes = new OpenAPIHono()

// --- GET /v1/stats/aggregate ---
const aggregateRoute = createRoute({
  method: 'get',
  path: '/stats/aggregate',
  summary: 'Get aggregate stats',
  request: {
    query: dateRangeSchema.extend({
      metrics: z.string().optional(), // comma-separated: visitors,pageviews,events
    }),
  },
  responses: {
    200: {
      description: 'Aggregate stats',
      content: {
        'application/json': {
          schema: z.object({
            visitors: z.number(),
            pageviews: z.number(),
            events: z.number(),
            bounceRate: z.number(),
            avgSessionDuration: z.number(),
          }),
        },
      },
    },
  },
})

statsRoutes.openapi(aggregateRoute, async (c) => {
  const project = c.get('project')
  const query = c.req.valid('query')
  
  const stats = await getAggregateStats(project.id, query)
  return c.json(stats)
})

// --- GET /v1/stats/timeseries ---
const timeseriesRoute = createRoute({
  method: 'get',
  path: '/stats/timeseries',
  summary: 'Get stats over time',
  request: {
    query: dateRangeSchema.extend({
      metric: z.enum(['visitors', 'pageviews', 'events']).default('visitors'),
      granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
    }),
  },
  responses: {
    200: {
      description: 'Time series data',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(z.object({
              timestamp: z.string(),
              value: z.number(),
            })),
          }),
        },
      },
    },
  },
})

statsRoutes.openapi(timeseriesRoute, async (c) => {
  const project = c.get('project')
  const query = c.req.valid('query')
  
  const data = await getTimeseriesStats(project.id, query)
  return c.json({ data })
})

// --- GET /v1/stats/breakdown ---
const breakdownRoute = createRoute({
  method: 'get',
  path: '/stats/breakdown',
  summary: 'Get stats broken down by property',
  request: {
    query: dateRangeSchema.extend({
      property: z.enum(['page', 'referrer', 'country', 'browser', 'os', 'device']),
      metric: z.enum(['visitors', 'pageviews', 'events']).default('visitors'),
      limit: z.coerce.number().min(1).max(100).default(10),
    }),
  },
  responses: {
    200: {
      description: 'Breakdown data',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(z.object({
              value: z.string(),
              count: z.number(),
              percentage: z.number(),
            })),
          }),
        },
      },
    },
  },
})

statsRoutes.openapi(breakdownRoute, async (c) => {
  const project = c.get('project')
  const query = c.req.valid('query')
  
  const data = await getBreakdownStats(project.id, query)
  return c.json({ data })
})

export { statsRoutes }
```

---

## Phase 5: Error Handling

### 5.1 Consistent Error Responses

```typescript
// src/api/lib/errors.ts
import { HTTPException } from 'hono/http-exception'

export class ApiError extends HTTPException {
  constructor(
    status: number,
    public code: string,
    message: string,
  ) {
    super(status, { message })
  }
}

// Global error handler
export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return c.json({
      error: {
        code: err.code,
        message: err.message,
      },
    }, err.status)
  }
  
  if (err instanceof HTTPException) {
    return c.json({
      error: {
        code: 'ERROR',
        message: err.message,
      },
    }, err.status)
  }
  
  console.error(err)
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  }, 500)
}
```

---

## Phase 6: Testing & Docs

### 6.1 Manual Testing Checklist

- [ ] Create API key in UI, copy raw key
- [ ] `GET /v1/ping` with key → returns project info
- [ ] `GET /v1/ping` without key → 401
- [ ] `GET /v1/ping` with revoked key → 401
- [ ] `POST /v1/events` → event appears in dashboard
- [ ] `POST /v1/events/batch` → multiple events tracked
- [ ] `GET /v1/stats/aggregate` → returns correct numbers
- [ ] Rate limit test → 429 after limit
- [ ] Check Axiom logs for requests

### 6.2 Documentation

- [ ] OpenAPI spec auto-generated ✓
- [ ] Swagger UI at `/v1/docs` ✓
- [ ] Add markdown docs page to vemetric.com/docs/api
- [ ] Include: Authentication, Rate limits, Endpoints, Examples

---

## Implementation Order

1. **Database + Key Management** — schema, create/list/revoke, UI
2. **Hono Setup** — file structure, main app, mount point
3. **Auth Middleware** — key validation
4. **Ping Route** — verify auth works
5. **Logging Middleware** — Axiom integration
6. **Rate Limiting** — basic in-memory, add Redis later if needed
7. **Events Routes** — track single + batch
8. **Stats Routes** — aggregate, timeseries, breakdown
9. **Error Handling** — consistent format
10. **Docs** — verify Swagger UI works, add external docs

---

## Future Enhancements (not v1)

- `POST /v1/query` — flexible query endpoint for agents
- User tokens + `X-Vemetric-Project` header (CLI support)
- Webhook subscriptions
- SDK generation from OpenAPI spec

---

*Created: 2026-02-05*
