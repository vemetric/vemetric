# Vemetric Public API — Stats Routes Plan (Draft)

> **Status:** Not yet finalized. These routes will be added after the base API infrastructure and ping route are working.

---

## Common Schemas

```typescript
// apps/app/src/backend/api/schemas/common.ts
import { z } from '@hono/zod-openapi';

export const dateRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  period: z.enum(['today', '7d', '30d', '90d', '12m', 'all']).optional().default('30d'),
});

export const filterSchema = z
  .string()
  .optional()
  .describe('JSON-encoded filter config (same format as dashboard filters)');

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({
      field: z.string().optional(),
      message: z.string(),
    })).optional(),
  }),
});
```

---

## Stats Routes

These routes call the existing ClickHouse query functions from `packages/clickhouse/src/models/`.

```typescript
// apps/app/src/backend/api/routes/stats.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { dateRangeSchema, filterSchema } from '../schemas/common';

const statsRoutes = new OpenAPIHono();

// --- GET /v1/stats/aggregate ---
const aggregateRoute = createRoute({
  method: 'get',
  path: '/stats/aggregate',
  summary: 'Get aggregate stats for a time period',
  request: {
    query: dateRangeSchema.extend({
      metrics: z
        .string()
        .optional()
        .describe('Comma-separated: visitors,pageviews,events,bounce_rate,avg_session_duration'),
      filters: filterSchema,
    }),
  },
  responses: {
    200: {
      description: 'Aggregate stats',
      content: {
        'application/json': {
          schema: z.object({
            visitors: z.number().optional(),
            pageviews: z.number().optional(),
            events: z.number().optional(),
            bounceRate: z.number().optional(),
            avgSessionDuration: z.number().optional(),
          }),
        },
      },
    },
  },
});

statsRoutes.openapi(aggregateRoute, async (c) => {
  const project = c.get('project');
  const query = c.req.valid('query');
  const filterConfig = query.filters ? JSON.parse(query.filters) : undefined;

  // Reuse existing ClickHouse query functions
  const stats = await getAggregateStats(project.id, {
    ...resolveDateRange(query),
    filterConfig,
    metrics: query.metrics?.split(','),
  });

  return c.json(stats);
});

// --- GET /v1/stats/timeseries ---
const timeseriesRoute = createRoute({
  method: 'get',
  path: '/stats/timeseries',
  summary: 'Get stats over time',
  request: {
    query: dateRangeSchema.extend({
      metric: z.enum(['visitors', 'pageviews', 'events']).default('visitors'),
      granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
      filters: filterSchema,
    }),
  },
  responses: {
    200: {
      description: 'Time series data',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                timestamp: z.string(),
                value: z.number(),
              }),
            ),
          }),
        },
      },
    },
  },
});

statsRoutes.openapi(timeseriesRoute, async (c) => {
  const project = c.get('project');
  const query = c.req.valid('query');
  const filterConfig = query.filters ? JSON.parse(query.filters) : undefined;

  // Calls existing functions: getActiveUserTimeSeries, getPageViewTimeSeries, etc.
  const data = await getTimeseriesStats(project.id, {
    ...resolveDateRange(query),
    metric: query.metric,
    granularity: query.granularity,
    filterConfig,
  });

  return c.json({ data });
});

// --- GET /v1/stats/breakdown ---
const breakdownRoute = createRoute({
  method: 'get',
  path: '/stats/breakdown',
  summary: 'Get stats broken down by property',
  request: {
    query: dateRangeSchema.extend({
      property: z.enum([
        'page', 'referrer', 'source', 'utm_source', 'utm_medium', 'utm_campaign',
        'country', 'region', 'city', 'browser', 'os', 'device',
      ]),
      metric: z.enum(['visitors', 'pageviews', 'events']).default('visitors'),
      limit: z.coerce.number().min(1).max(100).default(10),
      filters: filterSchema,
    }),
  },
  responses: {
    200: {
      description: 'Breakdown data',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                value: z.string(),
                count: z.number(),
                percentage: z.number(),
              }),
            ),
          }),
        },
      },
    },
  },
});

statsRoutes.openapi(breakdownRoute, async (c) => {
  const project = c.get('project');
  const query = c.req.valid('query');
  const filterConfig = query.filters ? JSON.parse(query.filters) : undefined;

  // Calls existing functions: getMostVisitedPages, getCountryCodes, getTopSources, etc.
  const data = await getBreakdownStats(project.id, {
    ...resolveDateRange(query),
    property: query.property,
    metric: query.metric,
    limit: query.limit,
    filterConfig,
  });

  return c.json({ data });
});

export { statsRoutes };
```

---

## Testing

- [ ] **Stats route tests**: aggregate returns expected shape, timeseries with granularity, breakdown with property, invalid query returns 422
- [ ] `GET /api/v1/stats/aggregate` → returns correct numbers
- [ ] `GET /api/v1/stats/timeseries` → returns time series data
- [ ] `GET /api/v1/stats/breakdown?property=page` → returns page breakdown

---

_Extracted from PUBLIC-API-PLAN.md on 2026-02-05_
