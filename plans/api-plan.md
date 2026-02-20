# Vemetric Public API - Stats Query Endpoint Plan

## Overview

Public API for querying analytics data via one flexible query endpoint. Designed for both human developers and AI agents/CLIs.

**Design Principles:**

- One query endpoint for composable analytics requests
- Predictable, strongly validated request/response shapes
- Reuse existing internal concepts where possible (timespans, filters, operators)
- JSON request bodies (no URL-encoded filter DSL)
- Stable row shape for long-term compatibility
- Intentional v1 scope limit: `group_by` supports exactly one token

---

## Authentication

```
Authorization: Bearer <api_key>
```

API keys are project-scoped for v1. Project is resolved from API key.

---

## Base URL

```
https://api.vemetric.com/v1
```

---

## Endpoint

### POST `/stats/query`

Executes aggregate, timeseries, and breakdown query patterns.

---

## Request Conventions

### Date range

Use one field: `date_range`

Accepted values:

- Preset string:
  - `live`
  - `1hr`
  - `24hrs`
  - `7days`
  - `30days`
  - `3months`
  - `6months`
  - `1year`
- Custom range array (UTC):
  - `["2026-01-18", "2026-02-17"]`
  - `["2026-01-18T00:00:00Z", "2026-02-17T23:59:59Z"]`

Date rules:

- Only UTC is accepted.
- Non-UTC offsets (e.g. `+02:00`) are rejected.
- Date-only values are interpreted as UTC day boundaries.
- Array must contain exactly 2 entries: `[startDate, endDate]`.

### Metrics

Supported metrics:

- `users`
- `pageviews`
- `events`
- `bounce_rate`
- `visit_duration`

Default: all supported metrics.

### Filters

- `filters` is optional.
- `filtersOperator` is optional (`and` default, `or` supported).
- If omitted, no filters are applied.
- If provided, it must match the public API filter schema.

### Grouping

Use one field: `group_by: string[]`

- Dimension examples:
  - `[]`
  - `["country"]`
  - `["event:prop:plan"]`
- Time grouping token:
  - `"[interval:auto"]`
- Custom event prop grouping:
  - `["event:prop:custom_prop_name"]`

Rules:

- If `group_by` contains `interval:auto`, rows are time-grouped.
- If `group_by` does not contain `interval:auto`, rows are aggregated over full `date_range`.
- For v1, `group_by` can include max one item.
- For custom `date_range` arrays, start must be <= end.

### Sorting and pagination

- `order_by`: array of sort tuples `[[field, direction], ...]`
- tuple format:
  - `field`: metric name (`users`, `pageviews`, `events`, `bounce_rate`, `visit_duration`) or active group field (for example `country`, `event:prop:plan`, `date`)
  - `direction`: `asc` | `desc`
- `limit` / `offset` apply to returned rows
- deterministic tie-breaker: alphabetical by `group`, then by date value if present
- If a metric field is used in `order_by`, that metric must be included in `metrics`.
- If a group field is used in `order_by`, that field must be present in `group_by` (or `date` when `group_by=["interval:auto"]`).
- If `group_by=[]`, pagination params are ignored and the response contains one aggregate row.

### Subscription limits

Public API inherits project subscription limits for date ranges.

---

## Request Schema (conceptual)

```json
{
  "date_range": "30days",
  "metrics": ["users", "pageviews", "events"],
  "group_by": ["country"],
  "order_by": [["users", "desc"]],
  "limit": 100,
  "offset": 0,
  "filtersOperator": "and",
  "filters": []
}
```

Custom range variant:

```json
{
  "date_range": ["2026-01-18", "2026-02-17T23:59:59Z"],
  "metrics": ["users", "events"],
  "group_by": []
}
```

Defaults:

- `metrics`: all supported metrics
- `group_by`: `[]`
- `order_by`: `[]` (server applies deterministic default sort)
- `limit`: `100`
- `offset`: `0`

---

## Response Shape

```json
{
  "period": {
    "from": "2026-01-18T00:00:00Z",
    "to": "2026-02-17T23:59:59Z"
  },
  "query": {
    "date_range": "30days",
    "group_by": ["country"],
    "metrics": ["users", "pageviews", "events"],
    "order_by": [["users", "desc"]],
    "limit": 100,
    "offset": 0
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "returned": 1
  },
  "data": [
    {
      "group": {
        "country": "US"
      },
      "metrics": {
        "users": 120,
        "pageviews": 450,
        "events": 34
      }
    }
  ]
}
```

Rules:

- `group` contains all grouping keys for a row (including `date` when `group_by=["interval:auto"]`).
- `metrics` contains only requested metrics.
- If `group_by=[]`, each row has `group: {}`.

---

## Query Examples

### 1. Aggregate (single total)

```json
{
  "date_range": "30days",
  "metrics": ["users", "pageviews", "events", "bounce_rate", "visit_duration"],
  "group_by": []
}
```

**Example response:**

```json
{
  "period": {
    "from": "2026-01-18T00:00:00Z",
    "to": "2026-02-17T23:59:59Z"
  },
  "query": {
    "date_range": "30days",
    "group_by": [],
    "metrics": ["users", "pageviews", "events", "bounce_rate", "visit_duration"],
    "order_by": [["users", "desc"]],
    "limit": 100,
    "offset": 0
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "returned": 1
  },
  "data": [
    {
      "group": {},
      "metrics": {
        "users": 12453,
        "pageviews": 45231,
        "events": 342,
        "bounce_rate": 42.3,
        "visit_duration": 186
      }
    }
  ]
}
```

### 2. Timeseries (no other grouping)

```json
{
  "date_range": "30days",
  "metrics": ["users", "pageviews", "events"],
  "group_by": ["interval:auto"]
}
```

**Example response:**

```json
{
  "period": {
    "from": "2026-01-18T00:00:00Z",
    "to": "2026-02-17T23:59:59Z"
  },
  "query": {
    "date_range": "30days",
    "group_by": ["interval:auto"],
    "metrics": ["users", "pageviews", "events"],
    "order_by": [["date", "asc"]],
    "limit": 100,
    "offset": 0
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "returned": 2
  },
  "data": [
    {
      "group": {
        "date": "2026-01-18T00:00:00Z"
      },
      "metrics": {
        "users": 412,
        "pageviews": 1502,
        "events": 43
      }
    },
    {
      "group": {
        "date": "2026-01-19T00:00:00Z"
      },
      "metrics": {
        "users": 389,
        "pageviews": 1421,
        "events": 38
      }
    }
  ]
}
```

### 3. Breakdown (no timeseries)

```json
{
  "date_range": "30days",
  "metrics": ["users", "pageviews", "events"],
  "group_by": ["country"],
  "order_by": [["country", "desc"]],
  "limit": 100,
  "offset": 0
}
```

**Example response:**

```json
{
  "period": {
    "from": "2026-01-18T00:00:00Z",
    "to": "2026-02-17T23:59:59Z"
  },
  "query": {
    "date_range": "30days",
    "group_by": ["country"],
    "metrics": ["users", "pageviews", "events"],
    "order_by": [["country", "desc"]],
    "limit": 100,
    "offset": 0
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "returned": 3
  },
  "data": [
    {
      "group": {
        "country": "US"
      },
      "metrics": {
        "users": 3420,
        "pageviews": 12304,
        "events": 251
      }
    },
    {
      "group": {
        "country": "DE"
      },
      "metrics": {
        "users": 2103,
        "pageviews": 7821,
        "events": 174
      }
    },
    {
      "group": {
        "country": "GB"
      },
      "metrics": {
        "users": 1893,
        "pageviews": 6234,
        "events": 133
      }
    }
  ]
}
```

### 4. Event property breakdown (event scoped via `filters`)

```json
{
  "date_range": "30days",
  "metrics": ["events"],
  "group_by": ["event:prop:plan"],
  "order_by": [["events", "desc"]],
  "filtersOperator": "and",
  "filters": [
    {
      "type": "event",
      "name": {
        "operator": "is",
        "value": "signup"
      }
    }
  ]
}
```

**Example response:**

```json
{
  "period": {
    "from": "2026-01-18T00:00:00Z",
    "to": "2026-02-17T23:59:59Z"
  },
  "query": {
    "date_range": "30days",
    "group_by": ["event:prop:plan"],
    "metrics": ["events"],
    "order_by": [["events", "desc"]],
    "limit": 100,
    "offset": 0
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "returned": 3
  },
  "data": [
    {
      "group": {
        "plan": "pro"
      },
      "metrics": {
        "events": 156
      }
    },
    {
      "group": {
        "plan": "starter"
      },
      "metrics": {
        "events": 98
      }
    },
    {
      "group": {
        "plan": "enterprise"
      },
      "metrics": {
        "events": 23
      }
    }
  ]
}
```

---

## Validation Rules

- Reject unknown metrics / sort fields / directions
- Reject invalid `group_by` tokens
- Require valid `date_range` as preset or 2-item date array
- For `date_range` array, reject if start > end
- Enforce UTC-only date input
- `group_by` can include max one item in v1
- `event:prop:*` grouping requires event scoping in `filters`
- Reject when a metric in `order_by` is not included in `metrics`
- Reject when a group field in `order_by` is not present in active grouping

---

## Error Responses

Error codes follow existing uppercase conventions.

Validation example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "group_by.0",
        "message": "Invalid grouping token"
      }
    ]
  }
}
```

Custom range ordering validation example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "date_range",
        "message": "Start date must be before or equal to end date"
      }
    ]
  }
}
```

Plan limit example:

```json
{
  "error": {
    "code": "PLAN_LIMIT_EXCEEDED",
    "message": "Requested date range is not available on the current subscription"
  }
}
```

Other common errors:

- `UNAUTHORIZED`
- `RATE_LIMIT_EXCEEDED`
- `INTERNAL_ERROR`

---

## Implementation Notes

- Public API surface: only `POST /stats/query`
- Internal implementation can branch into aggregate/timeseries/breakdown paths based on `group_by` + `date_range`
- For `group_by` containing `interval:auto`, use existing internal interval selection logic
- Keep using existing auth, logging, rate limit, and error middleware patterns
- Reuse existing date range + filters logic and ClickHouse query builders where possible
