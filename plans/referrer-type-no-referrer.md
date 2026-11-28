# Referrer type: separate "no referrer" from "unknown"

Status: PR 1 implemented on `claude/referrer-type-none` (2026-11-10), incl. the backfill script `apps/worker/src/migrations/backfill-referrer-types.ts` (tested on the local database). No production mutations run; website docs (PR 2) not started.

Decided (2026-11-10):
- Visits without a referrer get the new stored type **`none`**, not an empty type (see alternative 3).
- The stored type **`direct` is renamed to `internal`** (same meaning: came from a page on the project's own domain). `direct` stays accepted as a filter value and is treated as `internal` (see 3.5). It is backfilled in the same mutation as `none`.
- `unknown` keeps its value; without the no-referrer visits it only means "a website or source without a category".
- The dashboard shows each type as its stored value, capitalised ("None", "Unknown", "Internal", …), so the label always matches the API/filter value. Tooltips and descriptions explain each type.
- No changelog entry.
- Users without a pageview (identify-only or server-side users) get `none` too, at ingestion and in the backfill.
- Pirsch imports are mapped to Vemetric types, in the importer and in the backfill (3.3).
- Added 2026-11-10: the referrer list gets `kagi.com`, `cn.bing.com`, `noai.duckduckgo.com` (search) and `doubao.com`, `kimi.com` (llm), in the same change and the same backfill mutation (3.9). Production showed more misses, which are added too (3.9 B, confirmed) and campaign params `fb`/`ig`/`google`, which stay `unknown` (3.9 C, decided). The backfill retypes every list key stored as `unknown`, incl. older entries such as `claude.ai`.
- Added 2026-11-10: the first-visit fields on the ClickHouse `user` table (`referrer`, `referrerUrl`, `referrerType`) must end up with the same values as the events and sessions, at ingestion and after the backfill (3.10). The MCP plan exposes them later as `firstVisit` (first-touch attribution) and waits for this change.

Origin: MCP real-world test (2026-11-10). For snappify in October, 3,377 of 4,078 `unknown` visitors had no referrer; the rest came from websites that aren't in Vemetric's referrer list (fabacademy.org, chakra-ui.com, …). AI assistants and people read `unknown` as "no referrer" and `direct` as "typed in / bookmark". Both are wrong.

## TL;DR

- **Why it happens:** for visits without a referrer, `getReferrer` returns `undefined`, so the workers leave the three referrer fields out of the insert. ClickHouse then fills in the column defaults: `referrer = ''`, `referrerUrl = ''` (default: `referrer`), and **`referrerType = 'unknown'`** (column default since migration `9_referrer.sql`). No code ever writes `''` for these visits. The `unknown` value comes from the schema, not from the worker.
- **The stored rows can be told apart:** `referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''` matches exactly the no-referrer rows. Every other `unknown` row has a non-empty `referrer`. So existing data can be fixed with one `ALTER TABLE … UPDATE` per table, which also renames `direct` → `internal`. No re-ingestion is needed.
- **Change:** new stored type **`none`** (= no referrer and no `ref`/`via`/`utm_source`/`source` param); `direct` → **`internal`**; `unknown` stays for websites and sources without a category. The dashboard shows the stored values capitalised, with a tooltip per type. The API, MCP and docs explain all values.
- **Order:** worker change (+ `direct` alias) → deploy → backfill mutation on `session_v3`, `event`, `user` (async, per partition, off-peak; also retypes the new referrer list entries) → straggler check and a re-run on the current month → Pirsch backfill → docs.

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

-- I) Search engines and AI assistants stored as unknown (for the referrer list, 3.9).
-- For unknown rows, referrer is the hostname without www. (or the ref/utm_source value), i.e. the lookup key.
SELECT referrer, uniq(projectId) AS projects, uniq(id) AS sessions
FROM session_v3
WHERE referrerType = 'unknown' AND referrer <> '' AND importSource = '' AND deleted = 0
  AND match(referrer, '(google|bing|brave|duckduckgo|yandex|kagi|ecosia|startpage|qwant|doubao|kimi|moonshot|chatgpt|openai|perplexity|claude|gemini|copilot|deepseek|mistral|grok)')
GROUP BY referrer ORDER BY sessions DESC LIMIT 50;

-- I2) Other unknown sources used across several projects (candidates for the list; small sites drop out)
SELECT referrer, uniq(projectId) AS projects, uniq(id) AS sessions
FROM session_v3
WHERE referrerType = 'unknown' AND referrer <> '' AND importSource = '' AND deleted = 0
GROUP BY referrer HAVING projects >= 3 ORDER BY projects DESC, sessions DESC LIMIT 50;
```

And on PostgreSQL (saved filters that use referrer types). Funnel steps only allow page and event filters (`packages/common/src/funnel.ts`), so funnels aren't affected:

```sql
SELECT
  count(*) FILTER (WHERE "filterConfig"::text LIKE '%"unknown"%') AS with_unknown,
  count(*) FILTER (WHERE "filterConfig"::text LIKE '%"direct"%') AS with_direct
FROM saved_filter WHERE "filterConfig"::text LIKE '%"referrerType"%';
```

### Production results (2026-11-10, read-only)

snappify, October 2026 (queries A–C):

| Table | `unknown`, empty/empty → `none` | `direct` → `internal` | `unknown` with a referrer (stays) | `unknown`, param only (stays) | search | llm | social | email |
|---|---|---|---|---|---|---|---|---|
| Pageviews (A) | 6,219 | 4,440 | 788 | 111 | 2,845 | 160 | 78 | 2 |
| Sessions (B) | 4,768 (3,281 users) | 327 | 460 | 108 | 2,530 | 148 | 36 | 1 |
| Users first seen (C) | 34 | 8 | 5 | – | 68 | 8 | – | 1 |

- The condition holds: every `unknown` row either has both fields empty or a non-empty `referrer`. There is no `unknown` row with an empty `referrer` and a set `referrerUrl`, and every `direct` row has an empty `referrer` and a set `referrerUrl`. No imported rows for snappify.
- `none` is the largest session bucket (4,768 of 8,378 sessions, 57 %). `unknown` shrinks from 5,336 to 568 sessions.
- `direct` is far larger for pageviews (4,440) than for sessions (327): every pageview resolves its own referrer, so in-app navigation is `direct` (→ `internal`) at the event level. Sessions take the referrer of their first event only.

Sizes (E, E2, F): `event` 34 M rows / 3.6 GiB (95 parts, nearly all Wide; largest partition 202610: 5.6 M rows / 496 MiB), `session_v3` 7.9 M rows / 695 MiB, `user` 1.0 M rows / 69 MiB (no partition). Compressed column sizes (all parts): `event` `referrer` 18 MiB, `referrerType` 24 MiB, `referrerUrl` 50 MiB; `session_v3` 14 / 16 / 23 MiB; `user` under 0.2 MiB each. See 3.2 for the duration.

H: `session_v3` has 2 parts (4,655 rows) where neither `referrerType` nor `referrerUrl` is materialized. `event` and `user` have none. So the backfill sets `referrerUrl = referrerUrl` on `session_v3` (3.2).

J (snappify users whose first visit differs from their first pageview, before the backfill): about 250 users, mostly `unknown` vs. `search` (150) and `email` vs. `search` (34). See 3.10.

PostgreSQL: no saved filter uses `direct` or `unknown` (3.4).

D (rows the backfill changes, all projects; row versions, not distinct visits):

| Table | → `none` | → `internal` | Total rows |
|---|---|---|---|
| `event` | 23.6 M (69 %) | 3.3 M | 34.1 M |
| `session_v3` | 3.8 M (48 %) | 0.37 M | 7.9 M |
| `user` | 0.97 M (97 %) | 4.7 k | 0.99 M |

`event` includes custom and server-side events, which never have a referrer. On `user`, nearly all rows are `none`: most users have no pageview with a referrer, or no pageview at all.

G (Pirsch imports): channels `Direct`, `Organic Search`, `Organic Social`, `Organic Video`, `Referral`, `AI`, `Email`; no paid channel. `Direct` also appears **with** a referrer (16,363 sessions, 33,962 events); query K shows these are real sources (Google, t.co, Threads, …), see 3.3. I, I2: see 3.9.


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
- `apps/worker/src/workers/create-user-worker.ts`: add `referrer: ''`, `referrerUrl: ''`, `referrerType: 'none'` to the base user object (next to `firstSeenAt: createdAt`), before `...getUserFirstPageViewData(firstPageView)`. So users created without a pageview get `none` instead of the `'unknown'` default, and a first pageview still overrides it. `enrich-user-worker.ts` fills in the first pageview later (it only checks `origin`, which stays empty).
  - Changed from the first draft (`getUserFirstPageViewData(null)` returning the `none` fields): keep `{}` for "no pageview". On the user merge redesign branch ([vemetric/vemetric#141](https://github.com/vemetric/vemetric/pull/141)), `create-user-worker.ts` passes `getUserFirstPageViewData(null)` as `firstPageView` into the `create` op, and the `attribute` op compares and keeps the earliest first pageview. A non-empty object without `firstSeenAt` there would look like a first pageview. Whichever of the two PRs lands second puts the `none` default into the create path (on #141: the `create` op's base fields in `user-state.ts`).
- `apps/worker/src/ingestion/session-flush.ts`: the placeholder row for a session whose state has no `session` yet (`state.session ?? { projectId, id, startedAt, … }`) has no referrer keys, so it gets `'unknown'` from the default. Add `referrer: ''`, `referrerUrl: ''`, `referrerType: 'none'` to it; the next revision replaces it anyway once the session is initialised.
- Leave the ClickHouse column `DEFAULT 'unknown'` unchanged. Parts written before migration 9 may not have `referrerType` materialized; their value is computed from the default when read. Changing the default would relabel those rows silently. Query H below checks this; the backfill materializes the column anyway.
- Tests: `apps/worker/tests/utils/referrer.test.ts` (no header and no param gives `none`; an empty `v-referrer` gives `none`; a param only gives `unknown` or the list type; the own domain gives `internal`). Add an ingestion integration test that a session and event without a referrer are stored with `none`.

```sql
-- H) Parts where referrerType or referrerUrl isn't materialized (the value then comes from DEFAULT on read)
SELECT p.table, col.column, count() AS parts, sum(p.rows) AS rows
FROM system.parts AS p
CROSS JOIN (SELECT arrayJoin(['referrerType', 'referrerUrl']) AS column) AS col
LEFT ANTI JOIN (SELECT table, name, column FROM system.parts_columns
                WHERE database = currentDatabase() AND active AND column IN ('referrerType', 'referrerUrl')) AS c
  ON p.table = c.table AND p.name = c.name AND col.column = c.column
WHERE p.database = currentDatabase() AND p.active AND p.table IN ('event', 'session_v3', 'user')
GROUP BY p.table, col.column;
```

`referrerUrl` matters because the backfill now also rewrites `referrer` (3.9) and `referrerUrl` defaults to `referrer`: in a part without a materialized `referrerUrl`, changing `referrer` would change the computed `referrerUrl` too. If H finds such parts, the backfill also sets `referrerUrl = referrerUrl`, which writes the current value before `referrer` changes. Both effects were checked on a throwaway local table: without `referrerUrl = referrerUrl`, a non-materialized `referrerUrl` followed the new `referrer` (`kagi.com` → `Kagi`); with it, it kept `kagi.com`. All assignments of one `UPDATE` see the old row values.

### 3.2 Backfill of existing data (ClickHouse mutations)

This is not a numbered migration file in `packages/clickhouse/migrations`. `migrate-prod` runs during the deploy, and an `ALTER … UPDATE` there would start before the new workers are live. Run it by hand (or with a small script under `scripts/`, like `apps/worker/src/migrations/migrate-referrers.ts` did) after the deploy.

One statement per table and partition does all three changes (`none`, `direct` → `internal`, the new list entries from 3.9):

```sql
-- first one small partition to measure (see Duration), then the whole table without IN PARTITION
ALTER TABLE session_v3 UPDATE
    referrerType = multiIf(
      referrerType = 'direct', 'internal',
      referrer = '' AND referrerUrl = '', 'none',
      transform(referrer, ['kagi.com', 'cn.bing.com', 'noai.duckduckgo.com', 'doubao.com', 'kimi.com'],
                          ['search',   'search',      'search',              'llm',        'llm'], referrerType)),
    referrer = if(referrerType = 'unknown',
      transform(referrer, ['kagi.com', 'cn.bing.com', 'noai.duckduckgo.com', 'doubao.com', 'kimi.com'],
                          ['Kagi',     'Bing',        'DuckDuckGo',          'Doubao',     'Kimi'], referrer),
      referrer)
    , referrerUrl = referrerUrl   -- session_v3: query H found 2 parts without a materialized referrerUrl; harmless elsewhere
  IN PARTITION 202610
  WHERE importSource = '' AND (referrerType = 'direct' OR (referrerType = 'unknown' AND (
          (referrer = '' AND referrerUrl = '')
          OR referrer IN ('kagi.com', 'cn.bing.com', 'noai.duckduckgo.com', 'doubao.com', 'kimi.com'))));
-- event: the same statement, also per partition
-- user: the same statement without IN PARTITION (no partition key) and without `importSource = ''` (no such column); one mutation
```

- For `unknown` rows, `referrer` is the lookup key the worker used (hostname without `www.`, or the `ref`/`utm_source` value), so the `transform` keys match exactly what the new worker would look up. The `if(referrerType = 'unknown', …)` keeps `internal` rows' `referrer` (a param value) untouched, as the worker does. The five keys are an example: the backfill script generates the key list from all list keys that occur as `unknown` (3.9, Backfill).
- `importSource = ''` keeps imported rows out of these statements; they get their own mapping in 3.3. The importer doesn't write `user` rows, and `user` has no `importSource` column. The `user` statement also covers users without a pageview, since their rows have the defaults `''`/`''`/`'unknown'`.
- The `user` statement must run after `event` is done (3.10): new users copy their first pageview from `event`, so users created while `event` still has old values copy them.

- **Background:** `ALTER … UPDATE` is asynchronous by default (`mutations_sync = 0`). It returns at once and runs in the background merge pool. Track it in `system.mutations` (`is_done`, `parts_to_do`, `latest_fail_reason`). If it slows down ingestion, `KILL MUTATION` stops it; parts that are already rewritten stay correct, and the statement is idempotent, so it can be started again later.
- **Cost:** a mutation rewrites every part of the partition: Wide parts get only a new `referrerType` column (reading `referrer`, `referrerUrl` and `referrerType`), Compact parts are rewritten whole. Doing both changes in one statement costs the same as `none` alone. Tables without block-number columns (ours) can't use the lightweight `UPDATE` (patch parts), so it has to be a classic mutation.
- **Duration (from E/F):** small. Nearly all parts are Wide, so the mutation reads `referrer`, `referrerUrl`, `referrerType` and rewrites `referrerType`, `referrer` and `referrerUrl`; the other columns are hard-linked. That is about 90 MiB compressed for all of `event`, about 55 MiB for `session_v3` and under 1 MiB for `user`. Expect seconds per partition and a few minutes for everything. Compact parts (37 on `event`, 7 MiB) are rewritten whole, which is negligible.
  - Procedure: run `session_v3` partition 202406 first and read the time from `system.part_log` (`event_type = 'MutatePart'`, `duration_ms`). If it is as fast as expected, run the rest of each table as one statement without `IN PARTITION` (`session_v3`, then `event`, then `user`) instead of partition by partition. Wait for `parts_to_do = 0` before starting the next table. Off-peak is still preferred, but not required at this size.
- **Consistency during the run:** partitions that are already migrated show `none`/`internal`, the others still `unknown`/`direct`. Filters stay correct thanks to the `direct` alias (3.5); grouped views show both names for a short window. That's acceptable.
- **Stragglers:** sessions that were in the Redis buffer during the deploy keep their old values (`direct`, or no referrer keys, which fall back to the `'unknown'` default) in later flushes. Rows read before the mutation and written back after it keep the old values too: user merges re-insert the moved events as they were read; on `user`, every write re-inserts the whole row (`update-user-worker.ts`, `enrich-user-worker.ts`, `create-user-worker.ts` for an existing user), and new users copy their first pageview, which may be an old, not yet migrated event. A mutation only covers parts that exist when it starts. Fix: one hour after the first run, check the current month and `user`, and re-run the statement where needed (it is idempotent; on `user` it is one more full mutation, which is small):

```sql
SELECT 'event' AS t, count() FROM event WHERE createdAt >= toStartOfMonth(now()) AND importSource = ''
  AND (referrerType = 'direct' OR (referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''))
UNION ALL SELECT 'session_v3', count() FROM session_v3 WHERE startedAt >= toStartOfMonth(now()) AND importSource = ''
  AND (referrerType = 'direct' OR (referrerType = 'unknown' AND referrer = '' AND referrerUrl = ''))
UNION ALL SELECT 'user', count() FROM user
  WHERE referrerType = 'direct' OR (referrerType = 'unknown' AND referrer = '' AND referrerUrl = '');
-- plus `OR referrer IN (<keys from 3.9>)` in each condition
```

  The `user` count reads all versions (no `FINAL`), so it also counts old versions that a newer row already replaces; a non-zero count is a reason to re-run, not an exact number.

- **Self-hosters:** the same statements go into the upgrade notes once self-hosting exists (see the self-hosting plan). Until then this is a one-off for production.
- **Local and test databases:** add the statements to a script so dev databases can be backfilled, and switch the seed data to `none`/`internal` (`analytics.integration.seeding.ts` uses `'direct'` on lines 372 and 562, plus the local seed).

### 3.3 Pirsch imports

`apps/worker/src/migrations/pirsch-data-import.ts` stores Pirsch's `channel` as `referrerType` as is (`row.channel || ''`, three places: events, pageviews, sessions). So imported projects show Pirsch's channel names next to Vemetric's types.

- **Channels in production (query G):** `Direct`, `Organic Search`, `Organic Social`, `Organic Video`, `Referral`, `AI`, `Email`. No paid channel.
- **Pirsch's `Direct` is unreliable** (query K, 2026-11-10): 16,363 imported sessions are `Direct` although they have a referrer, and they are real sources: Google search (`www.google.com`, 4,387), `accounts.google.com` (2,713), Twitter via `t.co` (2,400), Threads (about 4,500 over `l.threads.net`, `www.threads.net`, `l.threads.com`, `www.threads.com`), Gmail (275), Bing (259), DuckDuckGo (252), Hacker News, GitHub, Outlook, Reddit, Ecosia, Bluesky, plus websites and directories. Nearly all of these hosts are in Vemetric's list.
- **Scope:** in production, only one project has a Pirsch import so far (about 48,000 sessions and 106,000 events). So the backfill is one fixed SQL statement per table, not a per-project script.
- **Importer (future imports): Vemetric's list first, Pirsch's channel only as a fallback.** One `resolvePirschReferrer(row, projectDomain)` helper, used in all three places (events, pageviews, sessions):

  | Order | Condition | Type (and name) |
  |---|---|---|
  | 1 | empty `referrer` and `referrerUrl` | `none` |
  | 2 | the host of `referrerUrl` is the project's own domain | `internal` |
  | 3 | the host of `referrerUrl` (without `www.`) is a list key, or (no URL) `referrer` is a list key | the list type, and the list name as `referrer` |
  | 4 | channel `Organic Search` | `search` |
  | | `Organic Social`, `Organic Video` (YouTube is `social` in the list) | `social` |
  | | `AI` | `llm` |
  | | `Email` | `email` |
  | | `Paid Search`, `Paid Social`, `Display` (none in production yet) | `paid` |
  | | `Direct` with a referrer, `Referral`, anything else | `unknown` |

  Steps 2–3 follow the worker's `getReferrer` (same list, same `www.` handling, same own-domain rule); the helper (`resolvePirschReferrer` in `apps/worker/src/migrations/pirsch-data-import.ts`) looks the list up directly, because it has to know whether the list has an entry before falling back to the channel. Pirsch's `referrer_name` stays the `referrer` when the list has no entry. Imported rows then get the same type and name as natively tracked ones.
- **Backfill (existing imported rows): one fixed statement per table**, a simplified version of the importer mapping:
  - empty `referrer` and `referrerUrl` → `none`;
  - Pirsch's `Direct` with a referrer → the list type of the URL host, for the hosts found by query K (the list types of those hosts); other hosts → `unknown`;
  - all other channels by name.
  - Left out compared to the importer: the own-domain step (no own-domain host among the top 30 of query K, so it would hardly change anything) and renaming `referrer` to the list name (Pirsch's names mostly match already: "Google", "Twitter", "Threads").

  ```sql
  ALTER TABLE session_v3 UPDATE referrerType = multiIf(
      referrer = '' AND referrerUrl = '', 'none',
      referrerType = 'Direct', transform(replaceRegexpOne(domain(referrerUrl), '^www\\.', ''),
        ['google.com', 'google.co.uk', 'accounts.google.com', 't.co', 'l.threads.net', 'threads.net', 'l.threads.com',
         'threads.com', 'com.google.android.gm', 'bing.com', 'duckduckgo.com', 'bsky.app', 'news.ycombinator.com',
         'github.com', 'outlook.live.com', 'reddit.com', 'ecosia.org'],
        ['search', 'search', 'unknown', 'social', 'social', 'social', 'social',
         'social', 'email', 'search', 'search', 'social', 'social',
         'social', 'email', 'social', 'search'], 'unknown'),
      transform(referrerType,
        ['Organic Search', 'Organic Social', 'Organic Video', 'AI', 'Email', 'Referral'],
        ['search', 'social', 'social', 'llm', 'email', 'unknown'], 'unknown'))
    WHERE importSource = 'pirsch'
      AND referrerType NOT IN ('none', 'search', 'social', 'email', 'paid', 'llm', 'unknown', 'internal');
  -- same for event
  ```

  It runs after the main backfill (3.2), which leaves imported rows out. The `NOT IN` condition skips rows that already have a Vemetric type, so a second run changes nothing. Checked on a throwaway local table (2026-11-10): an empty referrer gives `none`, `Direct` + `www.google.com` gives `search`, `Direct` + `android-app://com.google.android.gm/` gives `email` (`domain()` handles the app scheme), `Direct` + an unlisted host gives `unknown`, `Organic Search` / `AI` / `Referral` give `search` / `llm` / `unknown`, and rows that aren't imported or are already mapped stay unchanged.
- Test: unit tests for `resolvePirschReferrer`: an empty referrer gives `none`; `Direct` with `https://www.google.com/` gives Google/search; `Direct` with `https://t.co/…` gives Twitter/social; `Referral` with an unlisted host gives `unknown`; `AI` with an unlisted host gives `llm`; the project's own domain gives `internal`.

### 3.4 Saved filters (PostgreSQL)

Not needed. Production check (2026-11-10): no saved filter contains `direct` or `unknown` (`with_unknown = 0`, `with_direct = 0`; referrer type filters are stored as `"type": "referrerType"`, which the query matches). So no script. A saved filter with `direct` created before the deploy would still work through the alias (3.5); its filter button would show the old value until it is saved again. Funnels aren't affected (page and event filters only).

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
- The **referrer tab** groups by `referrer`, so its row `''` ("Direct / None") includes no-referrer visits (`none`) *and* own-domain entries without a param (`internal`). Decided 2026-11-10: keep them grouped in one row (that's what most people look for on the referrer tab; the split is available on the referrer type tab). The label stays "Direct / None"; add a tooltip: "Visits without a referrer and visits from your own domain". In the API, [vemetric/vemetric#160](https://github.com/vemetric/vemetric/pull/160) returns `""` for this group (instead of "Direct / None").
- The user and session views (`user-detail-column.tsx:259`, `session-event-group.tsx:209`, `globe-marker-user-detail.tsx:138`) show `referrer || 'Direct'`, so a visit without a referrer is labelled "Direct" there. Show the type instead when `referrer` is empty: `none` → "None", `internal` → "Internal" (with the tooltip).
- **User detail page, "First seen" card** (`user-detail-column.tsx`, rendered by `users/$userId.tsx`): today it never shows `referrerType`. The "Referrer" row is wrapped in `{user.referrer && …}`, so it is hidden whenever `referrer` is empty, i.e. for `none` and for `internal` without a param; its `'Direct'` fallback and the "Direct page visit." tooltip are dead code. Change:
  - Show the row whenever the user has a first pageview (`user.origin` set). Users without a pageview have no first visit to show (their type is `none`, but the card has no URL either).
  - `referrer` set: favicon and name as today; tooltip "Referred via {referrerUrl}" plus the type ("Type: Search"). Param-only referrers have no `referrerUrl`; then the tooltip names the param value instead of an empty "Referred via".
  - `referrer` empty: `ReferrerTypeIcon` and the capitalised type ("None" or "Internal") with the description tooltip; for `internal` the tooltip also shows `referrerUrl` (the own-domain page).
  - Check in the browser with a local user of each kind: `none` (no referrer), `internal` (own domain, no param), a list source (e.g. `kagi.com` → "Kagi", type Search), an unknown website.
- No change is needed for filter values from the data (`groupArrayDistinct(referrerType)` in `event.ts`). `none` and `internal` show up automatically.

### 3.7 Public API and MCP

**Base: [vemetric/vemetric#160](https://github.com/vemetric/vemetric/pull/160)** (MCP package A, not merged as of 2026-11-10) adds referrer type descriptions that describe today's behaviour, and makes the query API return `""` for empty group values (`formatGroupedFieldValue`). Start the implementation branch from main after #160 is merged, or rebase onto it once it is, so these descriptions are there to update.

- `apps/app/src/backend/api/schemas/api-filters.ts`, the description of the `referrerType` filter `value` (#160 lists all types): add `none` ("no referrer: typed in, bookmarks, apps"), replace `direct` with `internal` ("came from a page on the project's own domain; `direct` is accepted as an old name"), and change `unknown` to "a website or source that isn't in Vemetric's list of known sources; visits without a referrer are `none`". Update the example values (`direct` → `internal`).
- `apps/app/src/backend/mcp/tools.ts`, the `query_analytics` description ("referrerType values: …"): the same three changes, in the same words. Keep the tool definition test under its size limit.
- #160's descriptions of an empty `referrer` ("An empty string matches visits without a referrer" in `api-filters.ts`, the `"referrer"` example in `filterMeaning` in `tools.ts`, the `groupBy` text in `analytics.ts`): an empty `referrer` also contains `internal` entries without a `ref` param (also true today for `direct`). Add "and visits from the project's own domain; use the referrer type `none` for visits without a referrer only".
- **Empty group values with `referrerType`:** the query API groups by the stored column directly (`getFieldExpression` in `packages/clickhouse/src/utils/query-group.ts`, no joins), so after the change and the backfill, visits without a referrer come back as `none`. `""` would only appear for rows stored with an explicit `''`, and the only writer of that is the Pirsch importer (`row.channel || ''`), which 3.3 maps to `none` (importer and backfill). The `session-flush.ts` placeholder (3.1) gets `none` too. So `""` shouldn't appear for `referrerType` after the rollout; the generic "rows without a value are grouped under `""`" text of #160 can stay.
- API compatibility:
  - Filters: no break. `direct` still works (alias); `unknown` gets a narrower meaning.
  - Responses grouped by `referrerType` return `internal` instead of `direct` and the new `none`. Clients that match on the string `"direct"` need to update. Since there's no changelog entry, the API docs are the only place this shows.

### 3.8 Website docs (`vemetric/website`)

The docs don't explain referrer types anywhere yet. Add:
- `src/content/docs/dashboard.mdx`: a short section "Traffic sources and referrer types" with the table from section 2. Mention that typed-in traffic is `none` (what other tools call "Direct"), and that `internal` was called `direct` before.
- The API docs: the `referrerType` filter values and the query endpoint (`src/content/api-endpoint-docs/post-v1-query.mdx`; its empty-value paragraph from the website branch `claude/api-empty-group-values` stays valid). List the types with the same wording as 3.7, incl. the `direct` alias and that grouped results now return `internal` instead of `direct`. Generated from OpenAPI where possible. The MCP docs once they exist (Phase 5).

### 3.9 Referrer list additions

Production results (queries I and I2, 2026-11-10; sessions across all projects, stored as `unknown`).

**A. Requested from the MCP real-world test** (all confirmed by query I):

| Key | Name | Type | Projects / sessions |
|---|---|---|---|
| `cn.bing.com` | Bing | search | 56 / 2,539 |
| `kagi.com` | Kagi | search | 45 / 1,176 |
| `noai.duckduckgo.com` | DuckDuckGo | search | 40 / 565 |
| `doubao.com` | Doubao | llm | 17 / 212 |
| `kimi.com` | Kimi | llm | 3 / 39 |

**B. Further misses (confirmed 2026-11-10, part of this change):**

| Key | Name | Type | Projects / sessions |
|---|---|---|---|
| `r.search.yahoo.com`, `ph.search.yahoo.com` | Yahoo! | search | 39 / 936, 19 / 319 |
| `startpage.com` | Startpage | search | 37 / 384 |
| `html.duckduckgo.com`, `start.duckduckgo.com` | DuckDuckGo | search | 7 / 50, 4 / 25 |
| `safe.search.brave.com` | Brave | search | 7 / 43 |
| `yandex.uz` | Yandex | search | 10 / 37 |
| `search.nortonsafesearch.com` | Norton Safe Search | search | 15 / 43 |
| `copilot.com` | Microsoft Copilot | llm | 42 / 541 |
| `edgeservices.bing.com` (Copilot in the Edge sidebar) | Microsoft Copilot | llm | 1 / 211 |
| `grok.com` | Grok | llm | 11 / 60 |
| `notebooklm.google.com` | NotebookLM | llm | 10 / 215 |
| `aistudio.google.com` | Google AI Studio | llm | 4 / 20 |
| `vertexaisearch.cloud.google.com` (source links in Gemini answers) | Google Gemini | llm | 7 / 15 |
| `gemini` (param) | Google Gemini | llm | 15 / 308 |
| `openai` (param) | ChatGPT | llm | 17 / 96 |
| `m.youtube.com` | Youtube | social | 24 / 1,076 |
| `go.bsky.app` | Bluesky | social | 22 / 198 |
| `teams.public.onecdn.static.microsoft` | Microsoft Teams | social | 35 / 1,078 |
| `l.wl.co` (WhatsApp's link wrapper) | WhatsApp | social | 16 / 270 |
| `threads` (param) | Threads | social | 17 / 2,080 |

**C. Campaign params (decided 2026-11-10: stay `unknown`).** `fb` (15 projects, 197,785 sessions), `ig` (22 / 35,103) and `google` (11 / 20,523) are `utm_source` values. Meta ads set `utm_source=fb`/`ig` by default, and `utm_source=google` usually comes with Google Ads, so much of this is probably paid traffic. Vemetric only types by source, never by `utm_medium`, so the choice is:
  - map them like their domains (`fb` → Facebook/social, `ig` → Instagram/social, `google` → Google/search). Consistent with a `facebook.com` referrer, but ad traffic then counts as social/search; or
  - leave them `unknown` until paid detection by `utm_medium` (`cpc`, `paid`, …) exists, which is a separate feature.

  Decided: leave them `unknown`. They are not added to the list; paid detection by `utm_medium` is a possible follow-up.

**D. Already in the list, but stored as `unknown`:** `copilot.microsoft.com` (14 projects / 496 sessions), `gemini.google.com` (9 / 311), `claude.ai` (3 / 93). These rows were stored before the entries were added to `customReferrers`; nothing ever retyped them. So the backfill must not only cover the new keys but **every** key of the current list (see Backfill below).

**Stays `unknown` on purpose:**
- `Google` (57 projects / 9,564 sessions) is the name of Snowplow's untyped Google entries, mostly `accounts.google.com`, i.e. coming back from "Sign in with Google". Its country variants (`accounts.google.no`, `.co.in`, `.de`, …) aren't in the list and show as hostnames; same meaning.
- Google tools: `docs.`, `keep.`, `calendar.`, `classroom.`, `meet.`, `translate.`, `chromewebstore.google.com`, `storage.googleapis.com`, `cse.google.com`; `search.google.com` (Search Console, i.e. site owners), `google_jobs_apply`, `mokka.corp.google.com`.
- Websites and tools: `vercel.com`, `checkout.stripe.com`, `app.vemetric.com`, `msn.com`, `ntp.msn.com`, `ahrefs.com`, `app.raindrop.io`, `medium.com`, `substack.com`, directories (`producthunt.com` and the `producthunt` param, `uneed.best`, `peerlist`, `indiehackers.com`, `trustmrr`, …). Product Hunt could be `social`; left out unless wanted.
- `localhost`, `127.0.0.1` (development), and spam-like hosts (`bing.org`, `google.org`, `yandex.org`, `webdig.asia`, …).
- Not sure: `notebook.google.com` (6 / 185); left out until clear what it is.

- **Where:** `apps/worker/src/consts/referrers.ts` is generated by `apps/worker/fetch-referrers.ts` (Snowplow list + `customReferrers`). Add the entries to `customReferrers`, otherwise the next refresh drops them. Then put the same entries into the generated `referrers.ts` and add each new name (`Kagi`, `Doubao`, `Kimi`, plus those from B, e.g. `Startpage`, `Grok`, `NotebookLM`, `WhatsApp`) to `REFERRER_URL_MAP` in `apps/app/src/frontend/consts/referrer-types.ts` (used by the referrer filter button). Edit the generated files by hand instead of running the script: the script also pulls the current Snowplow list, which may retype other domains that this backfill doesn't cover. A full refresh is a separate change.
- **Subdomains:** `getReferrer` looks up the hostname exactly, only with `www.` removed (`getNormalizedDomain` in `packages/common/src/url.ts`), or the param value. There is no subdomain fallback, so `cn.bing.com` misses `bing.com`, and `noai.duckduckgo.com` misses `duckduckgo.com`. That is how the Snowplow list is meant to be used: it lists every host explicitly, because subdomains of one company have different types. `mail.google.com` is email, `gemini.google.com` is llm, `news.google.*` is search, and `support.`, `maps.`, `accounts.`, `drive.`, `sites.`, `groups.google.com` are deliberately `unknown`. A generic "drop the first label and retry" would type hosts like `docs.google.com`, `translate.google.com` or `edgeservices.bing.com` (the Edge sidebar) as search.
  - Recommendation: keep exact matching and add the missing hosts explicitly. Query I lists the Google, Bing, Brave and other search/AI hosts stored as `unknown`; each one found goes into the table above (and so into the backfill keys), or stays `unknown` on purpose, like `support.google.com`. Query I2 shows other sources used across several projects.
  - A narrow suffix rule only for engines where every subdomain is the same search engine (`*.duckduckgo.com`) is possible, but not needed for the hosts found so far. Not part of this change.
- **Backfill:** the same mutation as `none`/`internal` (3.2) retypes stored `unknown` rows whose `referrer` is a key of the list and sets the name (`kagi.com` → `Kagi`), so the referrer tab doesn't show `kagi.com` and `Kagi` as two rows. Because of D above, the keys are **all** keys of the updated list, not only the new ones. The backfill script builds the statement:
  1. `SELECT DISTINCT referrer FROM session_v3 WHERE referrerType = 'unknown' AND referrer <> ''` (and the same on `event`, `user`),
  2. keeps those that are keys of `referrers` in `apps/worker/src/consts/referrers.ts`,
  3. writes the `transform` arrays (name and type per key) and the `IN (…)` list from them.
  This keeps the statement short (the full list has about 2,100 keys, close to ClickHouse's 256 KiB `max_query_size`), and the script prints the statement for review before running it. Imported Pirsch rows are left out (3.3 maps them by channel).
- **Twitter → X** (decided 2026-11-11): the Snowplow list names `twitter.com`, `t.co` and `com.twitter.android` "Twitter", while `x.com` was already "X" in `customReferrers`, so the referrer tab split one source into two rows. `fetch-referrers.ts` renames list sources via `renamedReferrers` (`Twitter` → `X`, icon domain stays `api.x.com`). The backfill renames stored `Twitter` rows to `X` in the same mutation (`RENAMED_REFERRERS`), imported Pirsch rows included; rows typed `unknown`, `internal` or `direct` are skipped, there `Twitter` is a raw `ref`/`utm_source` value. Saved filters or bookmarked URLs with the referrer `Twitter` stop matching after the backfill.
- **Tests:** `referrer.test.ts`: `https://kagi.com/search?q=…` gives `{ referrer: 'Kagi', referrerType: 'search' }`, `https://cn.bing.com/` gives Bing, `https://www.kimi.com/` gives Kimi (`www.` removed), `?ref=kagi.com` gives Kagi.

### 3.10 First visit on the `user` table

`getUserFirstPageViewData` (`apps/worker/src/utils/user.ts`) copies the first pageview's `referrer`, `referrerUrl` and `referrerType` onto the `user` row (`ReplacingMergeTree`, `2_user.sql`; read with `argMax(…, updatedAt)`). The MCP plan exposes these fields later as `firstVisit`.

- **New users** (checked in the code):
  - `create-user-worker.ts`: copies `getFirstPageViewByUserId` (the earliest pageview event with `sum(sign) > 0`). With the worker change, that event already has `none`/`internal`/the list type, so the user gets the same value. Without a pageview: the `none` default from 3.1.
  - `enrich-user-worker.ts`: same copy, for users created before their first pageview arrived (only when `origin` is empty).
  - **User merge**, current main (`merge-user-worker.ts`): moves the old user's events and sessions to the new user and re-inserts the events with their stored `referrerType`. It never touches the new user's first-visit fields, so they keep whatever was copied at creation (an earlier merged pageview does not replace them; that is pre-existing and not part of this change). Nothing in the merge path can produce `unknown`/`direct` for new data, but events it re-inserts during the backfill keep the values it read, which the straggler re-run (3.2) covers.
  - **User merge redesign** ([vemetric/vemetric#141](https://github.com/vemetric/vemetric/pull/141), not merged): after moving events, it reads the earliest pageview again and applies it with an `attribute` op through `getUserFirstPageViewData`. So it also copies the new types. The `none` default for users without a pageview has to go into its `create` op (3.1).
- **Existing users:** the backfill rewrites `user` with the same statement as `event` and `session_v3` (3.2), after `event` is done. Stragglers on `user` are more likely than on the other tables, because every user update re-inserts the whole row; the straggler check includes `user`.
- **Check after the backfill** (aggregates only): the first visit and the first pageview agree for users with a pageview.

  ```sql
  -- J) users of one project whose referrerType differs from their first pageview's (should be ~0 after the backfill)
  SELECT u.referrerType AS userType, e.referrerType AS firstPageviewType, count() AS users
  FROM (SELECT projectId, id, argMax(referrerType, updatedAt) AS referrerType, argMax(origin, updatedAt) AS origin
        FROM user WHERE projectId = {projectId:UInt64} GROUP BY projectId, id HAVING origin <> '') AS u
  INNER JOIN (SELECT projectId, userId, argMin(referrerType, createdAt) AS referrerType
              FROM event WHERE projectId = {projectId:UInt64} AND isPageView = 1 AND sign = 1
              GROUP BY projectId, userId) AS e
    ON u.projectId = e.projectId AND u.id = e.userId
  WHERE u.referrerType <> e.referrerType
  GROUP BY ALL ORDER BY users DESC LIMIT 20;
  ```

  Baseline (production, snappify, before the backfill): about 250 users differ, mostly user `unknown` vs. first pageview `search` (150), `email` vs. `search` (34), `search` vs. `unknown` (18), `unknown` vs. `llm` (17). These come from the merge path: `create-user-worker.ts` copies the first pageview the identified user id has *at creation time*. The anonymous pageviews that are merged in afterwards are often earlier (e.g. the Google visit before sign-up), and current main never updates the user's first visit from them (the `email` rows are likely the confirmation-mail click after sign-up). [vemetric/vemetric#141](https://github.com/vemetric/vemetric/pull/141) fixes this for new merges with the `attribute` op.
  - So after the backfill, J should show the same users with the renamed types (`direct` → `internal`, empty `unknown` → `none`), not ~0. New differences that involve `none`/`internal` on one side and the old value on the other mean stragglers.
  - For the MCP `firstVisit` field this matters more than the rename: on current main it is "first pageview after identification", not first touch, for users with an anonymous history. Existing users would need a one-time re-attribution from their earliest pageview (after #141, the same `attribute` op). That is a separate change, not part of this plan.
- **Tests:** a worker test that a user created from a pageview without a referrer gets `none`, from an own-domain pageview `internal`, and without a pageview `none`.
- **Dashboard:** the "First seen" card (3.6).

## 4. Rollout order

1. Run queries A–J and the PostgreSQL counts on production (done 2026-11-10). Confirm the mutation condition, estimate the duration, and finalise the referrer list additions from I/I2 (3.9). J gives the baseline of users whose first visit differs from their first pageview.
2. PR 1 (vemetric): worker `none`/`internal` (incl. users without a pageview), the referrer list additions (3.9), the "First seen" card (3.6), the Pirsch mapping in the importer (`resolvePirschReferrer`), `REFERRER_TYPES`, the `direct` alias, labels, tooltips and icons in the dashboard, API and MCP descriptions (on top of #160), tests, the backfill script.
3. Deploy. Wait until the old worker containers are gone and the queues have drained.
4. Backfill: `session_v3` → `event` → `user` (`user` only after `event` is done): one small test partition, then one statement per table (minutes in total, see 3.2). Watch `system.mutations` and the ingestion metrics.
5. About one hour later: straggler check (incl. `user`) and a re-run on the current partition and on `user` if needed. Then query J again.
6. Pirsch backfill (3.3): one statement each on `session_v3` and `event`.
7. PR 2 (website): docs section and API docs. Publish after step 4.
8. Re-run the MCP real-world question ("how much traffic has no referrer") against production.

## 5. Open questions

1. ~~Labels~~: decided 2026-11-10. Labels are the capitalised stored values; `direct` is renamed to `internal`, `unknown` stays (see section 2).
2. **Referrer tab row `''`** ("Direct / None"): it contains both `none` visits and `internal` entries without a `ref` param, which the Referrer Type tab shows as two rows. Decided 2026-11-10: keep them grouped (no hostname as referrer for internal entries, no extra backfill), keep the label "Direct / None", and add a tooltip that names both types (see 3.6).
3. ~~Users without a pageview~~: decided 2026-11-10. They get `none`, at ingestion (3.1) and in the `user` backfill (3.2).
4. ~~Pirsch imports~~: decided 2026-11-10. They are mapped to Vemetric types in the importer and with a backfill (3.3); the exact channel names come from query G.
5. **Internal entries:** GA counts a session that starts with internal navigation under the previous session's source ("last non-direct click"). Worth considering later; out of scope here.
