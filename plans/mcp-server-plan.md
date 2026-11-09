# Vemetric MCP Server – Design (Phase 0)

## Goal

Let AI assistants (Claude, ChatGPT, Cursor, VS Code, …) answer questions about a user's Vemetric projects by calling read-only tools. There is no beta: once the phases below are done, the MCP server is generally available to all Vemetric users.

## Decisions

- **Library:** official MCP TypeScript SDK v2 (`@modelcontextprotocol/server`), mounted in the existing Hono app. Its `createMcpHandler` serves the 2026-07-28 revision and 2025-era clients statelessly from one server factory, so the `@modelcontextprotocol/hono` adapter (body parsing, localhost host checks) isn't needed.
- **Endpoint:** `https://mcp.vemetric.com/mcp` in the cloud, following the common `mcp.<domain>/mcp` convention (Linear, Notion, Sentry, Supabase, …). Served by the existing app service (`mcp.vemetric.com` is an extra domain on it), mounted next to `/api` in `apps/app/src/backend/app.ts`. Stateless Streamable HTTP, no sessions. The root of `mcp.vemetric.com` redirects browsers to the docs page.
  - Login and consent stay on `app.vemetric.com` (the authorization server, where the session cookie lives). The MCP endpoint is the protected resource that trusts it.
  - Self-hosting: `<app URL>/mcp` by default, so no extra subdomain is needed. An optional `MCP_URL` allows a dedicated host.
  - Exactly one MCP URL per deployment, because OAuth tokens are bound to the resource URL.
- **Auth:** OAuth 2.1 as the main path (the MCP standard), API keys as a fallback. See [Authentication](#authentication).
- **Plans:** available on all plans. The same retention limits as the REST API apply (`PLAN_LIMIT_EXCEEDED`), with an error message that lets the assistant explain it (see [Errors](#errors)).
- **Read-only:** the first release only has read-only tools. Every tool sets `readOnlyHint: true` and `openWorldHint: false`.
- **Shared logic:** tools call the same service functions as the REST API (`apps/app/src/backend/api/services/*`, Phase 1). A service takes an `ApiServiceContext` (`project`, `subscriptionStatus`) and the validated input, and returns the REST response object.

## Authentication

Both kinds of credentials arrive as `Authorization: Bearer <token>` on `/mcp`. The MCP auth middleware tells them apart by the `vem_` prefix of API keys.

### OAuth (main path)

The MCP authorization spec is OAuth 2.1. Clients like Claude.ai and ChatGPT only connect this way, and a one-click "Connect" with no key to copy is what users expect.

- **Provider:** `@better-auth/oauth-provider` (separate package since better-auth 1.7; the old `mcp`/`oidc-provider` plugins are no longer in core), added to the existing Better Auth instance in `apps/app/src/backend/utils/auth.ts`.
- **Client registration:** dynamic client registration (RFC 7591) without authentication, since MCP clients are public clients. Add Client ID Metadata Documents through `@better-auth/cimd`, which the newer MCP spec prefers. Delete registered clients that never got a token after some time.
- **Discovery:** `/.well-known/oauth-protected-resource/mcp` (RFC 9728) and the authorization server metadata (RFC 8414), registered at the domain root before the static app. A `401` from `/mcp` carries `WWW-Authenticate: Bearer resource_metadata="…"` so clients can start the flow.
- **Tokens:** PKCE, audience bound to the `/mcp` URL (RFC 8707 resource indicator, checked on every request), one scope `analytics:read` (plus `offline_access` for refresh tokens).
- **Pages in the SPA:** the existing login page returns to the authorization flow after sign-in. A new consent page shows the client's name and redirect domain (clients register themselves, so the name alone can't be trusted) and lets the user choose organizations and projects (see [Project access](#project-access)).
- **Connected apps:** a settings section that lists the authorized clients with their organizations/projects and lets the user change them or revoke access.
- **Self-hosting:** issuer and resource URLs come from `getVemetricUrl`.
- **Database:** Prisma migration for the plugin's tables (clients, tokens, consents) plus our own table for the organization/project selection.

### API keys (fallback)

Not part of the MCP spec, but static bearer tokens are common practice (GitHub, Stripe and others accept personal tokens on their remote MCP servers), and the developer clients (Claude Code, Cursor, VS Code, Codex, …) support custom headers. Useful for headless agents, CI scripts and clients without OAuth. MCP and REST use the same keys and the same key lookup (the REST `authMiddleware`).

### API key scopes

Today every key belongs to one project. Organization keys are added next to them (Phase 2), so a key can cover several projects in REST and MCP alike. Both kinds stay:

- **Project key:** belongs to one project, as today. Managed in the project settings and deleted together with the project.
- **Organization key:** managed in the organization settings and covers either
  1. **all current and future projects** of the organization, or
  2. **chosen projects** of the organization. Projects created later are not added automatically; deleted projects drop out of the selection.

Unlike OAuth tokens, a key acts for the organization, not for a user: it keeps working when the admin who created it leaves (as today, `createdByUserId` → `SetNull`). That is also why there is no "all organizations" level for keys. A key never spans organizations, so the subscription status (and with it the retention) always comes from that one organization. Only organization admins can create or revoke keys, as today (`projectAdminProcedure`, an organization-level procedure for organization keys).

- **Database:** `ApiKey` gets a required `organizationId` and an `allProjects` flag. `projectId` becomes optional and is set only for project keys (keeps the cascade on project deletion). The chosen projects of an organization key live in a new `api_key_project` table (cascades on project deletion too). The migration fills `organizationId` from each key's project, so existing keys stay project keys and keep working unchanged.
- **REST: choosing the project.** A request names the project in the `X-Vemetric-Project` header (documented once in the OpenAPI spec and the same on every endpoint, so no route or schema changes):
  - **Project keys** don't need it. If it is sent, it must match the key's project.
  - **Organization keys** always need it, even if the key currently covers only one project. Otherwise an integration would break as soon as a second project is created. A missing header returns `400 PROJECT_REQUIRED`.
  - A project the key doesn't cover returns `404 PROJECT_NOT_FOUND` (no hint that it exists).
  - New `GET /v1/projects` lists the projects the key covers (id, name, domain). With a project key, it returns that one project.
- **Rate limit:** still per project (`ratelimit:api:<projectId>`), so an organization key spread over several projects uses each project's bucket. Requests that don't name a project (`GET /v1/projects` with an organization key) or name one the key doesn't cover use a bucket of the key (`ratelimit:api:key:<keyId>`), so failed lookups are rate limited too.
- **Implementation:** `resolveApiKeyProject` / `listApiKeyProjects` in `apps/app/src/backend/api/utils/api-key-access.ts` (the resolver MCP builds on). The global `projectMiddleware` sets the project a request names; project routes declare the `requireProject` route middleware, which returns `PROJECT_REQUIRED`. It is route-level rather than path-based because the public API is mounted under `/api`.
- **UI:** the organization settings get an API keys section for organization keys (name, scope, created by/at, revoke). The project settings keep the project keys and mention the organization keys that also cover the project, with a link.

## Project access

The services never look at auth. The MCP layer turns the credentials into a list of allowed projects and builds the `ApiServiceContext` for the requested one.

- **OAuth:** one connection covers several projects. On the consent page the user chooses one of:
  1. **All current and future organizations** (and all their projects).
  2. **Individual organizations.** For each one either **all current and future projects**, or
  3. **individual projects** of that organization. Projects created later are not added automatically.

  The choice is stored per user and client (`allOrganizations` flag + rows of either `organizationId` with "all projects" or `organizationId` + `projectId`). On every request the allowed projects are resolved against the user's current memberships, so joining an organization counts right away when (1) is chosen, and leaving one removes access right away in every case.

- **Adding projects later:**
  - **Connected apps** in the settings is the main place: the same organization/project selection as on the consent page, editable at any time.
  - **When creating a project** in an organization where a connected client only has individual projects, the create dialog offers "Also give access to: Claude, Cursor, …" (unchecked by default).
  - **In the assistant:** `list_projects` and the `PROJECT_NOT_FOUND` error include the link to connected apps, so the model can tell the user where to grant more access. It never reveals projects that are not shared.
  - Connecting the client again works too, but many clients skip the consent screen when a valid token exists, so it is not the path we point users to.
- **API key:** the projects the key covers (see [API key scopes](#api-key-scopes)). In MCP, `projectId` may be omitted whenever the key covers exactly one project, also for organization keys: unlike a REST integration, the model recovers from the missing-`projectId` error by calling `list_projects`.
- **Read vs. write:** all tools are read-only for now, so there is no choice on the consent page; a permission choice with nothing behind it would only confuse. When write tools come (e.g. managing funnels), they get their own scope (`analytics:write`). The consent page then shows it as a separate permission, and existing connections are asked for it only when a write tool is first used (step-up authorization: `403 insufficient_scope`, supported by the SDK's `scopeChallenge`). API keys stay read-only.
- **Tools:** every project-bound tool takes an optional `projectId`. If the credentials allow exactly one project, it may be omitted. Otherwise a missing `projectId` returns an error that tells the model to call `list_projects`. A project outside the allowed list returns `PROJECT_NOT_FOUND` (no hint that it exists).

## Tools

The inputs are derived from the REST request schemas (same defaults and the same `superRefine` checks). Descriptions are rewritten for LLMs.

| Tool                    | Service                    | Notes                                                                                                                                                                                                                                                           |
| ----------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_project`           | `getProject`               | Name, domain, created/first event timestamps. Also returns `today` (UTC) so the model can resolve "last week" etc. Drop `token` and the excluded IPs from the MCP output.                                                                                       |
| `query_analytics`       | `queryAnalytics`           | Main tool. `dateRange`, `metrics`, `groupBy` (max 1), `orderBy`, `limit` (default 100 as in REST), `filters`, `filtersOperator`.                                                                                                                                |
| `list_filter_values`    | `getFilterValues`          | Discover valid values (event names, paths, countries, UTM values, …) before filtering. MCP default `limit` 50.                                                                                                                                                  |
| `list_event_properties` | new: `listEventProperties` | **Gap:** the REST API has no way to list the property names of an event, but `event:prop:<name>` grouping and property filters need them. Backed by `clickhouseEvent.getEventProperties` (already used by the dashboard). Add a REST endpoint at the same time. |
| `list_users`            | `listUsers`                | Filters + sort. MCP default `limit` 20. Leave out `avatarUrl`.                                                                                                                                                                                                  |
| `get_user`              | `getUser`                  | `id` or `identifier`.                                                                                                                                                                                                                                           |
| `get_user_events`       | `getUserEvents`            | `id` or `identifier` + `dateRange`, `filters`, `limit` (MCP default 50).                                                                                                                                                                                        |
| `list_funnels`          | `listFunnels`              | Funnel ids, names, step definitions.                                                                                                                                                                                                                            |
| `get_funnel_results`    | `getFunnelResults`         | `funnelId` + `dateRange` + `filters`.                                                                                                                                                                                                                           |
| `list_projects`         | new                        | Projects the credentials allow (id, name, domain). With an API key, the projects the key covers.                                                                                                                                                                |

Possible later additions: `compare` flag on `query_analytics` (current vs previous period in one call), tools for the dashboard's "live" view.

### Prompts

Prompts are ready-made instructions the user picks in their client (e.g. as a slash command). They only use the tools above. Not every client shows prompts, so the server must work fully without them.

First release:

- `period_report` (`period`: week/month): the period vs the one before. Users, pageviews, top pages, top sources, top countries, notable events, funnel conversion changes.
- `investigate_change` (`metric`, `date`): compare the day with normal days, then break it down by referrer, country, page and device to find what explains the drop or spike.
- `funnel_analysis` (`funnel`): where people drop off, and which segments (country, device, referrer, campaign) convert better or worse.
- `conversion_sources` (`event`, e.g. signup): which sources, campaigns and landing pages bring the most conversions for the event, not just the most traffic.
- `user_journey` (`user`: id or identifier): first/last seen, location, key events and sessions of one user. For support and sales.

Prompts must respect the plan's retention: e.g. on the free plan, `period_report` with `month` can't compare with the month before, so the prompt tells the model to compare within what the plan includes or say what's missing instead of running into errors.

Later candidates:

- `launch_review` (`date`, optional `campaign`/`referrer`): before vs after a launch, which referrers brought traffic, how many conversions came from it.
- `page_report` (`path`): traffic trend, sources, bounce rate, visit duration, countries and devices of one page.
- `event_report` (`event`): trend of a custom event, breakdown by its properties, which users trigger it.
- `audience_overview` (optional `period`): countries, cities, devices, browsers, operating systems.

### Output

- Return `structuredContent` (the service result) and a compact JSON text block. No pretty-printing.
- Remove fields the model does not need (echoed `query`, `avatarUrl`, `token`). Keep `period` so the model knows which window it got.
- Keep `pagination.returned` and add `hasMore: returned === limit` so the model knows when to page.

### Errors

- Service errors (`ApiError`) become tool results with `isError: true` and a message that says how to recover, for example:
  - `PLAN_LIMIT_EXCEEDED` → states the plan, how far back it goes and the earliest available date, links to the billing page, and tells the model to explain this to the user instead of retrying. It may offer an answer for the part of the period the plan includes. Example: "The requested period starts 2025-01-01, but the project's Vemetric plan (Free) only includes data from the last 30 days (since 2026-09-28). Tell the user that this period isn't included in their plan and that they can upgrade to the Professional plan for longer data retention: https://app.vemetric.com/… You can offer to answer for the last 30 days instead." The free plan also rejects the `3months`, `6months` and `1year` presets.
  - `USER_NOT_FOUND` / `FUNNEL_NOT_FOUND` → "… Use list_users / list_funnels to find valid ids."
  - Validation errors → field + message from the zod issues, plus a hint to call `list_filter_values`.
- Auth failures stay HTTP 401 with `WWW-Authenticate`, not tool errors.
- Unexpected errors: generic message for the model, full error logged.

### Security

- All data in tool results that visitors can influence (paths, referrers, UTM values, event names, event and user properties, user display names) is untrusted. The server instructions and tool descriptions tell the model that tool results are data, never instructions.
- Read-only tools only.
- The consent page makes clear which client gets access to which projects, since any client can register itself.
- Rate limiting:
  - **Separate buckets per project:** `ratelimit:api:<projectId>` for REST (existing) and `ratelimit:mcp:<projectId>` for MCP, both 100 per minute. An agent hitting the limit is visible and harmless (the model waits), but a REST integration hitting it fails silently in production (a stats widget breaks, a BI sync fails). Several teammates using assistants on the same project, or one parallel `investigate_change` run (20–30 tool calls), can plausibly reach 100 per minute, so MCP traffic must not eat the REST quota. The worst case of 200 calls per minute per project is harmless for ClickHouse; protecting the database itself would be a global concurrency limit, independent of REST or MCP.
  - **Only `tools/call` counts.** Every MCP message is its own HTTP request (initialize, `tools/list`, …); those don't touch the data and don't count.
  - **Limit reached → tool error, not HTTP 429.** E.g. "Rate limit reached for this project, try again in 40 seconds.", so the model can explain it and wait instead of the client showing a generic failure.
  - **OAuth endpoints** (client registration, token) work without a key, so they get per-IP limits through Better Auth's built-in rate limiting.
- Log tool name, project id, duration and error code to Axiom. No result payloads in logs.

### Zod version

The app is on zod 4 (#140), and SDK v2 needs zod `^4.2` for `registerTool`'s `StandardSchemaWithJSON`. So the tools can be built from the REST request schemas directly: `.extend()` them with `projectId`, override the descriptions and default limits where the LLM needs something different, and pass the validated input straight to the services. One set of schemas, one validation pass.

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
17. "What happened to traffic on 2026-09-30? It looks like it dropped." → `query_analytics` per hour/day + breakdowns by referrer/country/page (the `investigate_change` prompt).
18. "Give me a weekly report." → `period_report` prompt (`week`).
19. "How many visitors did we have in January 2025?" on a free plan → `PLAN_LIMIT_EXCEEDED`. The assistant tells the user that this period isn't included in their Vemetric plan, mentions the upgrade, offers the last 30 days instead, and doesn't retry with other ranges.
20. "What's the average visit duration on the blog?" → `query_analytics` (`visitDuration`, page filter `/blog*`). Should also explain that visit duration isn't available per page when grouping by `page:path`.

## Phases

0. **Design** (this document). ✅
1. **Refactor:** move the logic of the public API route handlers into `apps/app/src/backend/api/services/*`. Existing unit and integration tests pass unchanged. ✅
2. **Organization API keys:** ✅ (branch `claude/org-api-keys`) see [API key scopes](#api-key-scopes). Migration, the credential → allowed projects resolver that MCP and OAuth reuse later, the `X-Vemetric-Project` header in the REST `authMiddleware` (`PROJECT_REQUIRED`, `PROJECT_NOT_FOUND` in `API_ERROR_CODES`), `GET /v1/projects`, organization settings UI, API docs. Its own PR, shipped before the MCP server.
3. **MCP server:** ✅ (branch `claude/mcp-server`) `/mcp` endpoint, the MCP auth middleware with API keys, project access, all tools above (incl. `list_projects` and `list_event_properties` + its REST endpoint), prompts, rate limiting, logging, tests via the SDK in-memory client, MCP Inspector. Can be deployed, but isn't announced or documented yet.
   - Code in `apps/app/src/backend/mcp/`: `index.ts` (Hono app, API key check, `createMcpHandler`), `caller.ts` (credentials → projects, lenient `projectId`), `tools.ts`, `prompts.ts`, `run-tool.ts` (project resolution, `ratelimit:mcp:<projectId>` / `ratelimit:mcp:key:<keyId>`, error mapping, `mcp.tool` logs in the API log stream), `errors.ts` (recovery messages incl. the plan limit text with the billing link).
   - REST: `POST /v1/events/properties` (`listEventProperties`). `authenticateApiKey` and `consumeRateLimit` are shared by REST and MCP.
   - Analytics rows are always sorted now, in REST too (before, rows came in ClickHouse's order without `orderBy`, so time series were jumbled and pages could overlap): by date for `interval:auto`, otherwise by the first metric descending, ties by the group value. `query_analytics` keeps the REST default limit of 100: every `interval:auto` series fits (at most ~60 hourly or 31 daily points, monthly beyond 90 days), and models set a lower limit for top-N questions.
   - `mcp` is in `API_PREFIXES` (`route-config.ts`), so the Vite dev server and the PWA service worker hand `/mcp` to Hono.
   - Only `query_analytics` advertises the full filter schema (~5 KB). The other tools declare filters as objects with a `type` ("same format as query_analytics") and validate them against the real schema, which halves the tool definitions to ~23 KB (~6.5k tokens). A test keeps them under 25 KB. Shared `$ref`s would have saved only ~25%, and some clients handle them poorly.
   - Verified end to end against the dev server with real data (legacy and 2026-07-28 clients). Still open: the `mcp.vemetric.com` domain and its root redirect (Phase 4), CORS if a browser-based client needs it.
4. **OAuth:** the `mcp.vemetric.com` domain on the app service in Coolify + DNS record, and the redirect of its root to the MCP docs (needed first: OAuth is tested with real clients against the public URL, and tokens are bound to it). `@better-auth/oauth-provider` + `@better-auth/cimd`, discovery endpoints, per-IP rate limits on the OAuth endpoints, consent page with organization/project selection, connected apps settings, "Also give access to" in the create-project dialog, client clean-up, tests with real clients (Claude.ai, ChatGPT, Claude Code, Cursor, VS Code) against a public URL.
5. **Launch (GA for all users):** MCP docs, "Connect your AI assistant" in the app, MCP Registry, Anthropic connectors directory, Cursor/VS Code listings, landing page badge, blog post + changelog.
   - **Naming:** publicly it's the "Vemetric MCP server" (the term other products and the directories use; "MCP" alone is the protocol). Plain "MCP" only where space is tight (sidebar entries, URL slugs like `/docs/mcp/...`). Headings and the in-app UI lead with the benefit ("Connect your AI assistant to Vemetric") and name the MCP server in the subtitle.
   - **MCP docs** in the website repo, as thorough as the API docs (`src/content/docs/api/`): getting started (what it is, the URL), setup per client (Claude.ai, ChatGPT, Claude Code, Cursor, VS Code), authentication (OAuth, API key fallback, organization vs. project keys), project selection, a reference of all tools and prompts, example questions, rate limits, errors and troubleshooting, security/privacy (read-only, which data leaves Vemetric). Linked from the docs navigation and `llms.txt`.
   - **Landing page badge:** the hero badge in `src/components/landing-page/HeroSection.astro` (website repo) says "The Vemetric API is live" and links to `/docs/api/getting-started`. Change it to "The Vemetric MCP server is live" (check it doesn't wrap on mobile, fallback "The MCP server is live"), link it to the MCP docs, and switch its colours from green to orange (`green.*` → `orange.*`, maybe a fitting icon instead of `tb/api`).
   - **Changelog entry** in the website repo: `src/content/changelog/YYYY-MM-DD.mdx`, named after the release day (rename it if the release slips), written like the existing entries: an emoji title ("🤖 Vemetric MCP Server"), short paragraphs on what it does and which assistants it works with, a screenshot (e.g. an assistant answering a question with Vemetric data), a link to the MCP docs and the `<CrispLink>` feedback line. Merge it together with the docs only after the MCP server is deployed.
