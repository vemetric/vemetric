# Referrer type: separate "no referrer" from "unknown"

Status: plan for review (2026-11-10). Nothing implemented; no production mutations run.

Decided (2026-11-10):
- Visits without a referrer get the new stored type **`none`**, not an empty type (see alternative 3).
- The stored type **`direct` is renamed to `internal`** (same meaning: came from a page on the project's own domain). `direct` stays accepted as a filter value and is treated as `internal` (see 3.5). It is backfilled in the same mutation as `none`.
- `unknown` keeps its value; without the no-referrer visits it only means "a website or source without a category".
- The dashboard shows each type as its stored value, capitalised ("None", "Unknown", "Internal", …), so the label always matches the API/filter value. Tooltips and descriptions explain each type.
- No changelog entry.
- Users without a pageview (identify-only or server-side users) get `none` too, at ingestion and in the backfill.
- Pirsch imports are mapped to Vemetric types, in the importer and in the backfill (3.3).

Origin: MCP real-world test (2026-11-10). For snappify in October, 3,377 of 4,078 `unknown` visitors had no referrer; the rest came from websites that aren't in Vemetric's referrer list (fabacademy.org, chakra-ui.com, …). AI assistants and people read `unknown` as "no referrer" and `direct` as "typed in / bookmark". Both are wrong.

## TL;DR

- **Why it happens:** for visits without a referrer, `getReferrer` returns `undefined`, so the workers leave the three referrer fields out of the insert. ClickHouse then fills in the column defaults: `referrer = ''`, `referrerUrl = ''` (default: `referrer`), and **`referrerType = 'unknown'`** (column default since migration `9_referrer.sql`). No code ever writes `''` for these visits. The `unknown` value comes from the schema, not from the worker.
- **The stored rows can be told apart:** `referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''` matches exactly the no-referrer rows. Every other `unknown` row has a non-empty `referrer`. So existing data can be fixed with one `ALTER TABLE … UPDATE` per table, which also renames `direct` → `internal`. No re-ingestion is needed.
- **Change:** new stored type **`none`** (= no referrer and no `ref`/`via`/`utm_source`/`source` param); `direct` → **`internal`**; `unknown` stays for websites and sources without a category. The dashboard shows the stored values capitalised, with a tooltip per type. The API, MCP and docs explain all values.
- **Order:** worker change (+ `direct` alias) → deploy → backfill mutation on `session_v3`, `event`, `user` (async, per partition, off-peak) → straggler check and a re-run on the current month → Pirsch backfill → saved filters script → docs.

## 1. How a visit without a referrer ends up as `unknown`

The path from the browser to ClickHouse:

1. **Web SDK** (`vemetric-web/src/client.ts`, `getBasicEventHeaders`): `referrer = document.referrer || undefined`. It is also dropped when it equals the current URL (reloads). Then `'v-referrer': referrer || undefined` sets the header to `undefined`, so no header is sent. Backend SDKs (node, php) never send `v-referrer`.
2. **Hub:** `sanitizeHeaders` (`apps/hub/src/utils/headers.ts`) keeps `v-referrer` if it is present. With no header, the queued job's `headers` simply lack the key. (The `'v-referrer': c.req.header('v-referrer') || ''` in `apps/hub/src/app.ts` is only for log bindings.)
3. **Workers:** `getReferrerFromRequest` (`apps/worker/src/utils/referrer.ts`) calls `getReferrer(domain, headers['v-referrer'] || undefined, paramValue)`. A missing header and an empty header are handled the same way. With neither header nor param, it returns `undefined`.
   - `event-worker.ts` inserts `{ …, ...referrer }` with no referrer keys.
   - `session-worker.ts` calls `bufferSessionUpdate({ …, ...referrer })` with no keys. The Redis state (`session-state.ts`, `combineSession`) stores the session object without referrer keys, and `session-flush.ts` inserts it as it is.
   - The user table: `getUserFirstPageViewData` (`apps/worker/src/utils/user.ts`) copies the fields from the first pageview, which already has `'unknown'`. Users without a pageview get `{}`, which also falls back to the defaults.
4. **ClickHouse:** `JSONEachRow` inserts fill in the defaults for missing keys. The column defaults on all three tables are `referrer String` (no default, so `''`), `referrerUrl String DEFAULT referrer`, and `referrerType String DEFAULT 'unknown'`.

Other cases, for comparison (today's values):

| Case | referrer | referrerUrl | referrerType |
|---|---|---|---|
| No header, no param | `''` (default) | `''` (default) | `unknown` (default) |
| Known site (from `consts/referrers.ts`) | name | url | list type (`search`, `social`, `email`, `paid`, `llm`, or `unknown` for 31 entries such as support.google.com) |
| Site not in the list | domain | url | `unknown` |
| Only a param (`?ref=x`, `?utm_source=x`) | list name or the param value | `''` | list type or `unknown` |
| Project's own domain | param value or `''` | url (never empty) | `direct` |
| Invalid URL (catch branch) | param or url (non-empty) | url | `unknown` |
| Pirsch import (`migrations/pirsch-data-import.ts`) | `referrer_name` | `referrer` | Pirsch `channel` as is (or `''`) |

So `unknown` + empty `referrer` + empty `referrerUrl` is unique to the no-referrer case, apart from imported rows (see 3.3).

### Local check (read-only, aggregates only)

On the local `vemetric` database, October pageviews of the largest local project: `unknown`/empty/empty = 181, `direct`/empty referrer/URL set = 144. Sessions: `unknown`/empty/empty = 14. This matches the trace. The rest of the local data is seeded and not representative.

### Production queries (please run read-only; aggregates only, no personal data)

Replace `{projectId}` (snappify) or pass `--param_projectId=…`. October 2026.

```sql
-- A) Pageviews per referrerType and whether referrer / referrerUrl are empty
SELECT referrerType, referrer = '' AS referrerEmpty, referrerUrl = '' AS referrerUrlEmpty, importSource,
       sum(sign) AS pageviews
FROM event
WHERE projectId = {projectId:UInt64} AND isPageView = 1
  AND createdAt >= '2026-10-01' AND createdAt < '2026-11-01'
GROUP BY ALL HAVING pageviews <> 0 ORDER BY pageviews DESC;

-- B) Sessions (what the top sources card counts)
SELECT referrerType, referrer = '' AS referrerEmpty, referrerUrl = '' AS referrerUrlEmpty, importSource,
       count() AS sessions, uniq(userId) AS users
FROM session_v3 FINAL
WHERE projectId = {projectId:UInt64} AND deleted = 0
  AND startedAt >= '2026-10-01' AND startedAt < '2026-11-01'
GROUP BY ALL ORDER BY sessions DESC;

-- C) Users first seen in October (first-touch data)
SELECT referrerType, referrer = '' AS referrerEmpty, referrerUrl = '' AS referrerUrlEmpty, count() AS users
FROM user FINAL
WHERE projectId = {projectId:UInt64} AND firstSeenAt >= '2026-10-01' AND firstSeenAt < '2026-11-01'
GROUP BY ALL ORDER BY users DESC;
```

Expected: `unknown`/1/1 is the large no-referrer bucket, and every other `unknown` row has `referrerEmpty = 0`. If `unknown`/1/0 or `unknown`/0/1 show up in noticeable numbers, I need to look at those before writing the mutation condition.

To size the migration (all projects, metadata only):

```sql
-- D) How many rows the backfill would change per table (all projects, all time)
SELECT 'event' AS t,
       countIf(referrerType = 'unknown' AND referrer = '' AND referrerUrl = '') AS to_none,
       countIf(referrerType = 'direct') AS to_internal
FROM event
UNION ALL SELECT 'session_v3', countIf(referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''), countIf(referrerType = 'direct') FROM session_v3
UNION ALL SELECT 'user', countIf(referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''), countIf(referrerType = 'direct') FROM user;

-- E) Part sizes and types (Compact parts are rewritten whole; Wide parts only rewrite the changed column)
SELECT table, part_type, count() AS parts, sum(rows) AS rows, formatReadableSize(sum(bytes_on_disk)) AS on_disk
FROM system.parts WHERE database = currentDatabase() AND active AND table IN ('event', 'session_v3', 'user')
GROUP BY table, part_type ORDER BY table, part_type;

-- F) Size of the columns the mutation reads (Wide parts only; compact parts report 0)
SELECT table, column, formatReadableSize(sum(column_data_compressed_bytes)) AS compressed,
       formatReadableSize(sum(column_data_uncompressed_bytes)) AS uncompressed
FROM system.parts_columns
WHERE database = currentDatabase() AND active AND table IN ('event', 'session_v3', 'user')
  AND column IN ('referrer', 'referrerUrl', 'referrerType')
GROUP BY table, column ORDER BY table, column;

-- G) Imported rows: which referrer types (Pirsch channels) the imports wrote, to finalise the mapping in 3.3
SELECT 'session_v3' AS t, importSource, referrerType, referrer = '' AS referrerEmpty, count() AS rows
FROM session_v3 WHERE importSource <> '' GROUP BY ALL
UNION ALL
SELECT 'event' AS t, importSource, referrerType, referrer = '' AS referrerEmpty, toUInt64(sum(sign)) AS rows
FROM event WHERE importSource <> '' GROUP BY ALL
ORDER BY t, rows DESC LIMIT 100;
```

And on PostgreSQL (saved filters that use referrer types). Funnel steps only allow page and event filters (`packages/common/src/funnel.ts`), so funnels aren't affected:

```sql
SELECT
  count(*) FILTER (WHERE "filterConfig"::text LIKE '%"unknown"%') AS with_unknown,
  count(*) FILTER (WHERE "filterConfig"::text LIKE '%"direct"%') AS with_direct
FROM saved_filter WHERE "filterConfig"::text LIKE '%"referrerType"%';
```

## 2. Model

### What other tools do

- **GA4:** session source/medium `(direct) / (none)` and the channel "Direct" mean no referrer and no campaign. Websites without a category are "Referral". Internal navigation is not a source (it continues the previous session's source).
- **Plausible, Fathom:** the source "Direct / None" means no referrer.
- **Matomo:** the channel "Direct Entry" means no referrer. Other websites are "Websites".
- **Umami, Pirsch:** "Direct" means no referrer.

Everyone uses **"Direct" for no referrer**, and nobody has a separate type for internal navigation. Vemetric's `direct` (= came from the project's own domain) goes against this convention. That is the root of the misreading, and the reason for the rename.

### New model

The label is always the stored value, capitalised. A tooltip on each value (top sources card, filter form, filter button) explains it.

| Stored value | Label | Meaning / tooltip | Icon |
|---|---|---|---|
| `none` **(new)** | None | "No referrer: typed in, bookmarks, apps, or the referrer was removed" (also server-side events) | `TbLinkOff` |
| `unknown` | Unknown | "A website or source without a category" (sites not in the referrer list, `ref` values, and 31 list entries without a category such as support.google.com) | `TbWorld` (replaces the question mark, which reads as "no data") |
| `internal` **(was `direct`)** | Internal | "From a page on your own domain", e.g. a new session after 30 minutes of inactivity or from another tab | `TbHome` (`TbDirectionSign` suggests "direct") |
| `search`, `social`, `email`, `paid`, `llm` | Search, Social, Email, Paid, Llm (or "LLM") | unchanged | unchanged |

Why `none`:
- It is short, can't be mistaken for a website category, and matches GA's `(none)`. `no_referrer` or `empty` are clumsier, and reusing `direct` would flip the meaning of an existing value (alternative 1).

Why rename `direct` → `internal`:
- `direct` is read as "typed in / bookmark" by everyone who knows another analytics tool, and by AI assistants. `internal` says what it is.
- Little extra cost now: the rename runs in the same mutation as `none`, the `direct` alias keeps existing filters working, and the MCP server isn't launched yet, so no AI setups depend on `direct`.

Labels that differ from the stored values (e.g. "Other" for `unknown`) were considered and dropped: the dashboard would then use other names than the API, MCP and filters.

### Alternatives considered

1. **Use `direct` for no referrer (industry convention) and `internal` for the own domain.** This flips the meaning of an existing value without any error: saved filters, dashboard links, API clients and MCP prompts that use `direct` would quietly return different data. Rejected. Because of the alias, `direct` stays reserved and can't be reused later.
2. **Map at query time instead of migrating** (`if(referrerType = 'unknown' AND referrer = '' AND referrerUrl = '', 'none', referrerType)` in every query and filter, or an `ALIAS` column). This avoids the mutation but spreads the special case into every query builder, filter, filter-values query and the API. The tables are small enough for a one-time mutation (to be confirmed with query D–F).
3. **Store `''` for no referrer ("no type at all")** instead of a named value. Rejected (2026-11-10):
   - `referrer` (which source) and `referrerType` (which category) are separate dimensions, and neither isolates no-referrer visits today: `referrer = ''` also includes own-domain entries (`direct` rows store an empty `referrer` and only set `referrerUrl`), and `unknown` also includes websites without a category. A visit without a referrer is a category of its own in every other tool (GA `(direct) / (none)`, Plausible "Direct / None", Matomo "Direct Entry"), so it gets a named type.
   - `getTopSources` (`packages/clickhouse/src/models/session.ts`) drops empty values on every tab except the referrer tab (`AND referrerType <> ''`), so the largest bucket would vanish from the referrer type tab.
   - The referrer type filter only offers named values, the API's `formatGroupedFieldValue` turns empty into `"unknown"`, and matching an empty value needs `eq ""`/`notEq ""`.
   - AI assistants read an empty value as missing data, not as "came without a referrer".

## 3. Changes

### 3.1 Worker (ingestion)

- `apps/worker/src/utils/referrer.ts`:
  - `getReferrer` returns `{ referrer: '', referrerUrl: '', referrerType: 'none' }` instead of `undefined`. Keep the return type non-optional (only `event-worker.ts` and `session-worker.ts` call it, through `getReferrerFromRequest`, and both spread the result).
  - The own-domain branch returns `referrerType: 'internal'` instead of `'direct'`.
  - This does not change how sessions merge: `combineSession` replaces the whole entry metadata when an earlier event arrives, and it ignores the referrer of later events. Today an earlier no-referrer event already wipes the referrer, because its keys are missing.
- `apps/worker/fetch-referrers.ts`: generate `REFERRER_TYPES` with `'none'` and `'internal'` instead of `'direct'`, then regenerate `apps/app/src/frontend/consts/referrer-types.ts`. Order for the filter UI: `none, search, social, llm, email, paid, unknown, internal`.
- `apps/worker/src/utils/user.ts`: `getUserFirstPageViewData(null)` returns `{ referrer: '', referrerUrl: '', referrerType: 'none' }` instead of `{}`, so users created without a pageview (`create-user-worker.ts`) get `none` instead of the `'unknown'` default. `enrich-user-worker.ts` still fills in the first pageview's data later (it only checks `origin`, which stays empty).
- Leave the ClickHouse column `DEFAULT 'unknown'` unchanged. Parts written before migration 9 may not have `referrerType` materialized; their value is computed from the default when read. Changing the default would relabel those rows silently. Query H below checks this; the backfill materializes the column anyway.
- Tests: `apps/worker/tests/utils/referrer.test.ts` (no header and no param gives `none`; an empty `v-referrer` gives `none`; a param only gives `unknown` or the list type; the own domain gives `internal`). Add an ingestion integration test that a session and event without a referrer are stored with `none`.

```sql
-- H) Parts where referrerType isn't materialized (the value then comes from DEFAULT on read)
SELECT p.table, count() AS parts, sum(p.rows) AS rows
FROM system.parts AS p
LEFT ANTI JOIN (SELECT table, name FROM system.parts_columns
                WHERE database = currentDatabase() AND active AND column = 'referrerType') AS c
  ON p.table = c.table AND p.name = c.name
WHERE p.database = currentDatabase() AND p.active AND p.table IN ('event', 'session_v3', 'user')
GROUP BY p.table;
```

### 3.2 Backfill of existing data (ClickHouse mutations)

This is not a numbered migration file in `packages/clickhouse/migrations`. `migrate-prod` runs during the deploy, and an `ALTER … UPDATE` there would start before the new workers are live. Run it by hand (or with a small script under `scripts/`, like `apps/worker/src/migrations/migrate-referrers.ts` did) after the deploy.

One statement per table and partition does both changes:

```sql
-- one partition at a time for the monthly-partitioned tables, oldest first
ALTER TABLE session_v3 UPDATE referrerType = if(referrerType = 'direct', 'internal', 'none') IN PARTITION 202610
  WHERE importSource = '' AND (referrerType = 'direct' OR (referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''));
ALTER TABLE event UPDATE referrerType = if(referrerType = 'direct', 'internal', 'none') IN PARTITION 202610
  WHERE importSource = '' AND (referrerType = 'direct' OR (referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''));
-- user has no partition key: one mutation
ALTER TABLE user UPDATE referrerType = if(referrerType = 'direct', 'internal', 'none')
  WHERE referrerType = 'direct' OR (referrerType = 'unknown' AND referrer = '' AND referrerUrl = '');
```

(`importSource = ''` keeps imported rows out of these statements; they get their own mapping in 3.3. The importer doesn't write `user` rows, and `user` has no `importSource` column. The `user` statement also covers users without a pageview, since their rows have the defaults `''`/`''`/`'unknown'`.)

- **Background:** `ALTER … UPDATE` is asynchronous by default (`mutations_sync = 0`). It returns at once and runs in the background merge pool. Track it in `system.mutations` (`is_done`, `parts_to_do`, `latest_fail_reason`). If it slows down ingestion, `KILL MUTATION` stops it; parts that are already rewritten stay correct, and the statement is idempotent, so it can be started again later.
- **Cost:** a mutation rewrites every part of the partition: Wide parts get only a new `referrerType` column (reading `referrer`, `referrerUrl` and `referrerType`), Compact parts are rewritten whole. Doing both changes in one statement costs the same as `none` alone. Tables without block-number columns (ours) can't use the lightweight `UPDATE` (patch parts), so it has to be a classic mutation.
- **Duration:** I can't estimate this without the production sizes (queries E/F). Method: run it first on the smallest old partition of `session_v3`, read the time from `system.part_log` (`event_type = 'MutatePart'`, `duration_ms`) and extrapolate by bytes. As a rough guide, column-only rewrites of small string columns take seconds to minutes per monthly partition at Vemetric's size. `event` is the largest table and decides the total. Run it off-peak, one partition at a time, and don't start a new one until `parts_to_do = 0`.
- **Consistency during the run:** partitions that are already migrated show `none`/`internal`, the others still `unknown`/`direct`. Filters stay correct thanks to the `direct` alias (3.5); grouped views show both names for a short window. That's acceptable.
- **Stragglers:** sessions that were in the Redis buffer during the deploy keep their old values (`direct`, or no referrer keys, which fall back to the `'unknown'` default) in later flushes. Rows read before the mutation and written back after it (user merges, which delete events with `sign = -1`) can also keep the old values. Fix: one hour after the first run, check the current month and re-run it for that partition:

```sql
SELECT 'event' AS t, count() FROM event WHERE createdAt >= toStartOfMonth(now()) AND importSource = ''
  AND (referrerType = 'direct' OR (referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''))
UNION ALL SELECT 'session_v3', count() FROM session_v3 WHERE startedAt >= toStartOfMonth(now()) AND importSource = ''
  AND (referrerType = 'direct' OR (referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''));
```

- **Self-hosters:** the same statements go into the upgrade notes once self-hosting exists (see the self-hosting plan). Until then this is a one-off for production.
- **Local and test databases:** add the statements to a script so dev databases can be backfilled, and switch the seed data to `none`/`internal` (`analytics.integration.seeding.ts` uses `'direct'` on lines 372 and 562, plus the local seed).

### 3.3 Pirsch imports

`apps/worker/src/migrations/pirsch-data-import.ts` stores Pirsch's `channel` as `referrerType` as is (`row.channel || ''`, three places: events, pageviews, sessions). So imported projects show Pirsch's channel names next to Vemetric's types.

- **Importer:** one `mapPirschChannel(channel, referrer, referrerUrl)` helper, used in all three places:
  - Pirsch's "Direct", an empty channel, or empty `referrer` and `referrerUrl` → `none`
  - search channels (e.g. "Organic Search") → `search`; paid channels ("Paid Search", "Paid Social", "Display", …) → `paid`; social → `social`; email → `email`; AI / LLM channels, if Pirsch has them → `llm`
  - "Referral" and anything else → `unknown`
  - Pirsch has no own-domain type, so nothing maps to `internal`.
- **Backfill:** the exact channel names come from query G. Then one more statement per table, with the same mapping as `transform(…)` (values not in the list fall back to `'unknown'`):

  ```sql
  ALTER TABLE session_v3 UPDATE referrerType = multiIf(
      referrer = '' AND referrerUrl = '', 'none',
      transform(referrerType, ['Direct', 'Organic Search', 'Paid Search', 'Social', 'Email', 'Referral' /* … from query G */],
                              ['none', 'search', 'paid', 'social', 'email', 'unknown'], 'unknown'))
    WHERE importSource = 'pirsch';
  -- same for event
  ```

  Imported rows are few (one-off imports per project), so this runs fast and needs no per-partition run. It is idempotent: already mapped values (`none`, `search`, …) go through the `transform` fallback, so the list must also map Vemetric's own types to themselves, or the statement adds `AND referrerType NOT IN ('none', 'search', 'social', 'email', 'paid', 'llm', 'unknown')`.
- Test: a unit test for `mapPirschChannel`.

### 3.4 Saved filters (PostgreSQL)

The `direct` alias (3.5) keeps saved filters working, but their filter buttons would still show "direct". A one-time script (Prisma, next to the backfill script) replaces `direct` with `internal` in `referrerTypeFilter.value` of every saved filter (`saved_filter."filterConfig"`). Run it after the deploy; it's idempotent. Funnels don't need it (page and event filters only).

### 3.5 `direct` alias

- One helper in `packages/common/src/sources.ts`, e.g. `normalizeReferrerType(value)`, maps `direct` → `internal` and leaves everything else unchanged.
- Backend: `buildReferrerTypeFilterQuery` (`packages/clickhouse/src/utils/filters/referrer-filter.ts`) normalises the filter values before `buildListFilterQuery`. This one place covers the dashboard (incl. old links and bookmarks with `direct` in the URL), saved filters, the REST API and MCP.
- Frontend: normalise when filters are read from the URL, so an old link shows "Internal" in the filter button.
- Keep the alias indefinitely; it costs nothing. `direct` is therefore reserved and can't get a new meaning later.

### 3.6 Dashboard

- Add one shared description map for referrer types (e.g. `REFERRER_TYPE_DESCRIPTIONS` in `packages/common/src/sources.ts`, so the API and MCP can reuse the texts). Labels are the capitalised stored values; no separate label map. Use it in:
  - `top-sources-card.tsx` (the referrer type tab shows the raw lowercase `topSource.referrerType` today): capitalised value plus tooltip. Also replace the click fallback `topSource[sourceType] ?? 'direct'` on line 148 with the row's real value.
  - `filter/filter-forms/referrer-type-form.tsx` and `filter-buttons/referrer-type-filter-button.tsx`: capitalised values and tooltips.
  - `referrer-icon.tsx` (`ReferrerTypeIcon`): `none` → `TbLinkOff`, `unknown` → `TbWorld`, `internal` → `TbHome` (remove the `direct` case).
- The **referrer tab** groups by `referrer`, so its row `''` ("Direct / None") includes no-referrer visits (`none`) *and* own-domain entries without a param (`internal`). Decided 2026-11-10: keep them grouped in one row (that's what most people look for on the referrer tab; the split is available on the referrer type tab). The label stays "Direct / None"; add a tooltip: "Visits without a referrer (type None) and visits from your own domain (type Internal)". The API's group label for an empty `referrer` (`formatGroupedFieldValue`) stays as it is too, unless MCP package A replaces it with `""`.
- The user and session views (`user-detail-column.tsx:259`, `session-event-group.tsx:209`, `globe-marker-user-detail.tsx:138`) show `referrer || 'Direct'`, so a visit without a referrer is labelled "Direct" there. Show the type instead when `referrer` is empty: `none` → "None", `internal` → "Internal" (with the tooltip).
- No change is needed for filter values from the data (`groupArrayDistinct(referrerType)` in `event.ts`). `none` and `internal` show up automatically.

### 3.7 Public API and MCP

- `apps/app/src/backend/api/schemas/api-filters.ts` (`referrerTypeApiFilterSchema`): list all values with their meaning, for example: "`none` = no referrer (typed in, bookmarks, apps); `search`, `social`, `email`, `paid`, `llm` = categorised sources; `unknown` = a website or source without a category; `internal` = came from a page on the project's own domain (`direct` is accepted as an old name for `internal`)." Use the same text for the `referrerType` groupBy field in the analytics query schema and in the OpenAPI docs. Update the example values (`direct` → `internal`).
- `apps/app/src/backend/mcp/tools.ts`: the same explanation in the `query_analytics` groupBy description and in the filter descriptions (in short form; keep the tool definition test under its size limit). Also mention in `list_filter_values`.
- **`formatGroupedFieldValue`** (`apps/app/src/backend/api/utils/analytics/grouping.ts`): **MCP package A has not been merged into main yet** (main still returns `'unknown'` for an empty `referrerType`; package A is only planned on `claude/mcp-descriptions`). Once `none` exists, empty `referrerType` values only come from imports or rows with an explicit `''`. The label `'unknown'` would mix them with real `unknown` values. If package A (return `""`) lands first, nothing more is needed here. Otherwise change this case to return `''` together with this change.
- API compatibility:
  - Filters: no break. `direct` still works (alias); `unknown` gets a narrower meaning.
  - Responses grouped by `referrerType` return `internal` instead of `direct` and the new `none`. Clients that match on the string `"direct"` need to update. Since there's no changelog entry, the API docs are the only place this shows.

### 3.8 Website docs (`vemetric/website`)

The docs don't explain referrer types anywhere yet. Add:
- `src/content/docs/dashboard.mdx`: a short section "Traffic sources and referrer types" with the table from section 2. Mention that typed-in traffic is `none` (what other tools call "Direct"), and that `internal` was called `direct` before.
- The API docs for the `referrerType` filter and group values (`src/content/api-endpoint-docs/…`, generated from OpenAPI where possible), incl. the `direct` alias, and the MCP docs once they exist (Phase 5).

## 4. Rollout order

1. Run queries A–H and the PostgreSQL counts on production. Confirm the mutation condition and estimate the duration.
2. PR 1 (vemetric): worker `none`/`internal` (incl. users without a pageview), the Pirsch channel mapping in the importer, `REFERRER_TYPES`, the `direct` alias, labels, tooltips and icons in the dashboard, API and MCP descriptions, grouping label (if package A hasn't merged), tests, backfill and saved-filters scripts.
3. Deploy. Wait until the old worker containers are gone and the queues have drained.
4. Backfill: `session_v3` → `event` → `user`, one partition at a time, off-peak. Watch `system.mutations` and the ingestion metrics.
5. About one hour later: straggler check and a re-run on the current partition if needed.
6. Pirsch backfill (3.3) on `session_v3` and `event`, with the channel list from query G.
7. Run the saved-filters script.
8. PR 2 (website): docs section and API docs. Publish after step 4.
9. Re-run the MCP real-world question ("how much traffic has no referrer") against production.

## 5. Open questions

1. ~~Labels~~: decided 2026-11-10. Labels are the capitalised stored values; `direct` is renamed to `internal`, `unknown` stays (see section 2).
2. **Referrer tab row `''`** ("Direct / None"): it contains both `none` visits and `internal` entries without a `ref` param, which the Referrer Type tab shows as two rows. Decided 2026-11-10: keep them grouped (no hostname as referrer for internal entries, no extra backfill), keep the label "Direct / None", and add a tooltip that names both types (see 3.6).
3. ~~Users without a pageview~~: decided 2026-11-10. They get `none`, at ingestion (3.1) and in the `user` backfill (3.2).
4. ~~Pirsch imports~~: decided 2026-11-10. They are mapped to Vemetric types in the importer and with a backfill (3.3); the exact channel names come from query G.
5. **Internal entries:** GA counts a session that starts with internal navigation under the previous session's source ("last non-direct click"). Worth considering later; out of scope here.
