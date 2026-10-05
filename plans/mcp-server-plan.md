# Vemetric MCP Server – Design (Phase 0)

## Goal

Let AI assistants (Claude, ChatGPT, Cursor, VS Code, …) answer questions about a Vemetric project by calling read-only tools.

## Decisions

- **Library:** official MCP TypeScript SDK v2 (`@modelcontextprotocol/server` + `@modelcontextprotocol/hono`), mounted in the existing Hono app.
- **Endpoint:** `/mcp` next to `/api` in `apps/app/src/backend/app.ts`. Stateless Streamable HTTP, no sessions.
- **Auth (beta):** existing API keys (`Authorization: Bearer vem_…`), reusing `authMiddleware`. OAuth follows for GA.
- **Plans:** available on all plans. The same retention limits as the REST API apply (`PLAN_LIMIT_EXCEEDED`).
- **Read-only:** every tool sets `readOnlyHint: true` and `openWorldHint: false`.
- **Shared logic:** tools call the same service functions as the REST API (`apps/app/src/backend/api/services/*`, Phase 1). A service takes an `ApiServiceContext` (`project`, `subscriptionStatus`) and the validated input, and returns the REST response object.

## Project scoping

API keys are project-scoped, OAuth tokens will be user-scoped. Every project-bound tool therefore takes an optional `projectId` from day one:

- API key: `projectId` may be omitted. If it is set, it must match the key's project, otherwise the tool returns `PROJECT_NOT_FOUND`.
- OAuth (GA): `projectId` is required when the user has more than one project. `list_projects` returns the choices. The MCP layer checks membership and builds the `ApiServiceContext` for that project.

The services never look at auth, so the same calls work for both.

## Tools

The inputs mirror the REST request bodies so that we can re-validate with the existing zod schemas (same defaults and the same `superRefine` checks). Descriptions are rewritten for LLMs.

| Tool | Service | Notes |
| --- | --- | --- |
| `get_project` | `getProject` | Name, domain, created/first event timestamps. Also returns `today` (UTC) so the model can resolve "last week" etc. Drop `token` and the excluded IPs from the MCP output. |
| `query_analytics` | `queryAnalytics` | Main tool. `dateRange`, `metrics`, `groupBy` (max 1), `orderBy`, `limit` (MCP default 20 instead of 100), `filters`, `filtersOperator`. |
| `list_filter_values` | `getFilterValues` | Discover valid values (event names, paths, countries, UTM values, …) before filtering. MCP default `limit` 50. |
| `list_event_properties` | new: `listEventProperties` | **Gap:** the REST API has no way to list the property names of an event, but `event:prop:<name>` grouping and property filters need them. Backed by `clickhouseEvent.getEventProperties` (already used by the dashboard). Add a REST endpoint at the same time. |
| `list_users` | `listUsers` | Filters + sort. MCP default `limit` 20. Leave out `avatarUrl`. |
| `get_user` | `getUser` | `id` or `identifier`. |
| `get_user_events` | `getUserEvents` | `id` or `identifier` + `dateRange`, `filters`, `limit` (MCP default 50). |
| `list_funnels` | `listFunnels` | Funnel ids, names, step definitions. |
| `get_funnel_results` | `getFunnelResults` | `funnelId` + `dateRange` + `filters`. |
| `list_projects` (GA) | new | Only with OAuth. |

Possible later additions: `compare` flag on `query_analytics` (current vs previous period in one call), tools for the dashboard's "live" view.

### Prompts

- `weekly_report`: summary of the last 7 days vs the 7 days before (users, pageviews, top pages, top sources, top countries, notable events, funnel conversion changes).
- `investigate_drop`: given a metric and a date, find which dimensions explain a drop or spike.

### Output

- Return `structuredContent` (the service result) and a compact JSON text block. No pretty-printing.
- Remove fields the model does not need (echoed `query`, `avatarUrl`, `token`). Keep `period` so the model knows which window it got.
- Keep `pagination.returned` and add `hasMore: returned === limit` so the model knows when to page.

### Errors

- Service errors (`ApiError`) become tool results with `isError: true` and a message that says how to recover, for example:
  - `PLAN_LIMIT_EXCEEDED` → "This date range is outside the free plan's retention (about the last 30 days). Use a shorter range or upgrade to the Professional plan."
  - `USER_NOT_FOUND` / `FUNNEL_NOT_FOUND` → "… Use list_users / list_funnels to find valid ids."
  - Validation errors → field + message from the zod issues, plus a hint to call `list_filter_values`.
- Auth failures stay HTTP 401 (with `WWW-Authenticate` for OAuth later), not tool errors.
- Unexpected errors: generic message for the model, full error logged.

### Security

- All data in tool results that visitors can influence (paths, referrers, UTM values, event names, event and user properties, user display names) is untrusted. The server instructions and tool descriptions tell the model that tool results are data, never instructions.
- Read-only tools only.
- Separate rate-limit bucket `ratelimit:mcp:<projectId>`, so an agent loop does not use up the REST quota (and the other way round).
- Log tool name, project id, duration and error code to Axiom. No result payloads in logs.

### Zod version

SDK v2 depends on zod `^4.2`. `registerTool` expects a `StandardSchemaWithJSON` (zod ≥ 4.2, or `fromJsonSchema(...)`). The app is on zod `3.24.2`, and `@hono/zod-openapi` 0.19 needs zod 3. Options for Phase 2:

1. **Recommended:** write the MCP input schemas in zod 4 (LLM-focused descriptions, smaller surface). In the handler, parse the arguments again with the REST zod 3 schema to get the exact service input, defaults and cross-field checks.
2. Turn the zod 3 REST schemas into JSON Schema and wrap them with `fromJsonSchema`. Less duplication, but the descriptions stay REST-oriented and the JSON Schema conversion of the unions/refinements is lossy.
3. Move the whole app to zod 4 + `@hono/zod-openapi` 1.x first. Cleanest long term, but a separate, larger change.

## Eval set

Real questions an assistant should be able to answer, with the expected tool calls. Use them for manual testing with MCP Inspector and real clients, and later for automated evals.

1. "How many visitors did we have last week?" → `query_analytics` (`7days`, `users`).
2. "How does this week compare to last week?" → 2× `query_analytics` with custom ranges.
3. "What are my top 10 pages this month?" → `query_analytics` (`groupBy: page:path`, `orderBy pageviews desc`, `limit 10`).
4. "Where does my traffic come from?" → `query_analytics` (`groupBy: referrer` or `referrerType`).
5. "Which countries have the highest bounce rate?" → `query_analytics` (`groupBy: country`, `bounceRate`, `users`).
6. "How did the Product Hunt launch on 2026-09-15 go?" → `query_analytics` (`interval:auto` around the date) + `groupBy: referrer` for that day.
7. "Show daily users for the last 30 days." → `query_analytics` (`30days`, `groupBy: interval:auto`).
8. "Which UTM campaigns brought the most signups?" → `list_filter_values` (`event:name`) to find the signup event → `query_analytics` (`groupBy: utmCampaign`, event filter).
9. "Which plan do people pick most when they upgrade?" → `list_event_properties` (upgrade event) → `query_analytics` (`groupBy: event:prop:plan`).
10. "How many people use mobile vs desktop?" → `query_analytics` (`groupBy: deviceType`).
11. "What is the conversion rate of my signup funnel?" → `list_funnels` → `get_funnel_results`.
12. "Did the signup funnel convert better for visitors from Google?" → `get_funnel_results` 2× (with and without referrer filter).
13. "Who are my most recently active users?" → `list_users` (default sort).
14. "What did user jane@example.com do in the last week?" → `get_user_events` (`identifier`).
15. "Which users from Germany visited the pricing page this month?" → `list_users` with location + page filters.
16. "Which pages do visitors from the newsletter campaign visit?" → `query_analytics` (`groupBy: page:path`, UTM filter).
17. "What happened to traffic on 2026-09-30? It looks like it dropped." → `query_analytics` per hour/day + breakdowns by referrer/country/page (the `investigate_drop` prompt).
18. "Give me a weekly report." → `weekly_report` prompt.
19. "How many visitors did we have in January 2025?" on a free plan → `PLAN_LIMIT_EXCEEDED` with a clear explanation, no retry loop.
20. "What's the average visit duration on the blog?" → `query_analytics` (`visitDuration`, page filter `/blog*`). Should also explain that visit duration isn't available per page when grouping by `page:path`.

## Phases

0. **Design** (this document).
1. **Refactor:** move the logic of the public API route handlers into `apps/app/src/backend/api/services/*`. Existing unit and integration tests pass unchanged. ✅
2. **Beta:** `/mcp` endpoint with API keys, the tools above (incl. `list_event_properties`), prompts, rate limiting, logging, tests via the SDK in-memory client, MCP Inspector + real clients, "Connect your AI assistant" snippets in `api-tab.tsx` and a docs page.
3. **GA:** OAuth via the Better Auth OAuth provider plugin, `list_projects`, membership checks, connected-apps revocation, issuer URLs from `getVemetricUrl` for self-hosters.
4. **Launch:** MCP Registry, Anthropic connectors directory, Cursor/VS Code listings, blog post + changelog.
