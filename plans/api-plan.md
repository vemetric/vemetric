# Vemetric Public API - Stats Endpoints Plan

## Overview

Public API for querying analytics data. Designed for both human developers and AI agents/CLIs.

**Design Principles:**
- Multiple clear endpoints > one super-flexible endpoint
- Predictable response shapes
- Clear parameter names
- Consistent filtering across all endpoints

---

## Authentication

```
Authorization: Bearer <api_key>
```

API keys scoped to organization/project (TBD).

---

## Base URL

```
https://api.vemetric.com/v1
```

---

## Endpoints

### 1. GET `/stats/aggregate`

Returns aggregate totals for a time period.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | string | yes | Project identifier |
| `period` | string | no | Time period: `today`, `7d`, `30d`, `12mo`, `custom` (default: `30d`) |
| `date_from` | string | no | Start date (ISO 8601) — required if period=custom |
| `date_to` | string | no | End date (ISO 8601) — required if period=custom |
| `metrics` | string | no | Comma-separated: `visitors`, `pageviews`, `visits`, `bounce_rate`, `visit_duration`, `events` (default: all) |
| `event` | string | no | Filter to specific event name (e.g., `signup`, `purchase`) |
| `filters` | string | no | Filter expression (see Filtering section) |

**Response:**

```json
{
  "period": {
    "from": "2026-01-18",
    "to": "2026-02-17"
  },
  "data": {
    "visitors": 12453,
    "pageviews": 45231,
    "visits": 18432,
    "bounce_rate": 42.3,
    "visit_duration": 186
  }
}
```

**Event-filtered example:**

```
GET /stats/aggregate?project_id=xxx&period=30d&event=signup
```

```json
{
  "period": { "from": "2026-01-18", "to": "2026-02-17" },
  "data": {
    "events": 342
  }
}
```

---

### 2. GET `/stats/timeseries`

Returns metrics over time (for charts).

**Parameters:**

Same as `/stats/aggregate`, plus:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `interval` | string | no | Granularity: `hour`, `day`, `week`, `month` (default: auto based on period) |

**Response:**

```json
{
  "period": {
    "from": "2026-01-18",
    "to": "2026-02-17"
  },
  "interval": "day",
  "data": [
    {
      "date": "2026-01-18",
      "visitors": 412,
      "pageviews": 1502,
      "visits": 620
    },
    {
      "date": "2026-01-19",
      "visitors": 389,
      "pageviews": 1421,
      "visits": 584
    }
  ]
}
```

---

### 3. GET `/stats/breakdown`

Returns metrics broken down by a dimension.

**Parameters:**

Same as `/stats/aggregate`, plus:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `breakdown` | string | yes | Dimension to break down by (see below) |
| `limit` | integer | no | Max results (default: 100) |

**Breakdown dimensions:**

- `page` — URL path
- `entry_page` — Landing page
- `exit_page` — Exit page
- `referrer` — Referrer URL
- `referrer_source` — Referrer source (Google, Twitter, etc.)
- `country` — Country code
- `city` — City name
- `region` — Region/state
- `browser` — Browser name
- `os` — Operating system
- `device` — Device type (desktop, mobile, tablet)
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `property:<name>` — Custom event property (e.g., `property:plan`, `property:variant`)

**Response:**

```json
{
  "period": {
    "from": "2026-01-18",
    "to": "2026-02-17"
  },
  "breakdown": "country",
  "data": [
    {
      "country": "US",
      "visitors": 3420,
      "pageviews": 12304
    },
    {
      "country": "DE",
      "visitors": 2103,
      "pageviews": 7821
    },
    {
      "country": "GB",
      "visitors": 1893,
      "pageviews": 6234
    }
  ]
}
```

**Event property breakdown example:**

```
GET /stats/breakdown?project_id=xxx&event=signup&breakdown=property:plan
```

```json
{
  "period": { "from": "2026-01-18", "to": "2026-02-17" },
  "breakdown": "property:plan",
  "data": [
    { "plan": "pro", "events": 156 },
    { "plan": "starter", "events": 98 },
    { "plan": "enterprise", "events": 23 }
  ]
}
```

---

## Filtering

Filters can be applied to all endpoints using the `filters` parameter.

**Syntax:**

```
filters=<dimension><operator><value>
```

Multiple filters separated by `;` (AND logic):

```
filters=country==US;browser==Chrome
```

**Operators:**

| Operator | Description |
|----------|-------------|
| `==` | Equals |
| `!=` | Not equals |
| `~` | Contains (string) |
| `!~` | Does not contain |

**Examples:**

```
# Visitors from the US
filters=country==US

# Visitors NOT from the US
filters=country!=US

# Mobile visitors from Germany
filters=country==DE;device==mobile

# Traffic from Google
filters=referrer_source==Google

# Pages containing /blog/
filters=page~/blog/
```

---

## CLI Commands

The CLI mirrors the API structure:

```bash
# Aggregate stats
vemetric stats aggregate --project <id> --period 30d

# Timeseries
vemetric stats timeseries --project <id> --period 7d --metrics visitors,pageviews --interval day

# Breakdown
vemetric stats breakdown --project <id> --period 30d --breakdown country

# With filters
vemetric stats aggregate --project <id> --period 30d --filters "country==US;device==mobile"

# Event stats
vemetric stats aggregate --project <id> --period 30d --event signup

# Event breakdown by property
vemetric stats breakdown --project <id> --event signup --breakdown property:plan
```

**Output formats:**

```bash
# Default: human-readable table
vemetric stats breakdown --project xxx --breakdown country

# JSON output (for piping/scripts)
vemetric stats breakdown --project xxx --breakdown country --json

# CSV output
vemetric stats breakdown --project xxx --breakdown country --csv
```

---

## Error Responses

```json
{
  "error": {
    "code": "invalid_parameter",
    "message": "Unknown breakdown dimension: invalid_dimension",
    "param": "breakdown"
  }
}
```

**Error codes:**

- `unauthorized` — Invalid or missing API key
- `forbidden` — API key doesn't have access to this project
- `invalid_parameter` — Invalid parameter value
- `missing_parameter` — Required parameter missing
- `rate_limited` — Too many requests
- `internal_error` — Server error

---

## Rate Limiting

- 100 requests per minute per API key
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers included

---

## Future Endpoints (Not in v1)

- `GET /funnels` — List funnels
- `GET /funnels/:id` — Get funnel analysis
- `GET /users` — User-level data
- `GET /events` — Raw event stream (if needed)

---

## Implementation Notes

1. **Start with:** `/stats/aggregate`, then `/stats/timeseries`, then `/stats/breakdown`
2. **Filtering can be added incrementally** — start with basic `==` filters, add operators later
3. **Response shape should be consistent** — always wrap in `{ period, data }` structure
4. **CLI can be a thin wrapper** around the HTTP API using the same param names
