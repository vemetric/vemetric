# Build FT.AGGREGATE Pipelines in the Correct Stage Order

`FT.AGGREGATE` runs stages in the order you write them, like a Unix pipeline. The canonical order is `LOAD → APPLY → FILTER → GROUPBY/REDUCE → APPLY → SORTBY → LIMIT`. Swapping stages doesn't error — it silently changes what your query computes. For paginating large aggregates, see [aggregate-cursors.md](aggregate-cursors.md).

**Correct:** Canonical pipeline against the Bicycle dataset — load needed fields, project a derived field, filter, group, sort, limit.

```
# Average price per brand for mountain bicycles, top 5 brands
FT.AGGREGATE idx:bicycle "@type:{mountain}"
    LOAD 3 @brand @price @condition
    APPLY "@price * 0.9" AS sale_price
    FILTER "@condition == 'new'"
    GROUPBY 1 @brand
        REDUCE COUNT 0 AS bike_count
        REDUCE AVG 1 @price AS avg_price
        REDUCE AVG 1 @sale_price AS avg_sale_price
    SORTBY 2 @avg_price DESC
    LIMIT 0 5
    DIALECT 2
```

## Stages, in order

| Stage | Purpose | Notes |
|-------|---------|-------|
| `LOAD n @f1 @f2 ...` | Hydrate fields from the source doc into the pipeline. | Only loaded fields are visible to later stages. `LOAD *` pulls everything (expensive). |
| `APPLY <expr> AS alias` | Project a computed field. | Operates row-by-row before grouping. |
| `FILTER <expr>` | Drop rows that fail a predicate. | Filters *pipeline rows*, not the underlying index. Index-level filters belong in the query string. |
| `GROUPBY n @f1 ... REDUCE <fn> ...` | Collapse rows that share group keys. | Reducers: `COUNT`, `COUNT_DISTINCT`, `SUM`, `AVG`, `MIN`, `MAX`, `STDDEV`, `QUANTILE`, `TOLIST`, `FIRST_VALUE`, `RANDOM_SAMPLE`. |
| `APPLY` (post-group) | Compute derived fields over reducer output. | E.g. `APPLY "@bike_count / @brand_count" AS share`. |
| `SORTBY n @f1 ASC ...` | Order the result. | The `n` is the count of (field, direction) tokens. |
| `LIMIT offset num` | Slice the result. | For result sets > 1000 rows, use `WITHCURSOR` (see [aggregate-cursors.md](aggregate-cursors.md)). |

> **Common errors per stage** — see "Counting tokens, not fields" and "FILTER and LOAD discipline" below for nargs miscount on `LOAD`/`GROUPBY`/`SORTBY`/`REDUCE COUNT`, missing `@` on pipeline field references, missing `ASC`/`DESC` on `SORTBY`, and FILTER-before-LOAD errors.

## Common reducers — quick reference

```
REDUCE COUNT 0 AS n                          # count rows in group
REDUCE COUNT_DISTINCT 1 @user_id AS uniq     # distinct values of @user_id
REDUCE SUM 1 @price AS total
REDUCE AVG 1 @price AS mean
REDUCE MIN 1 @price AS lo
REDUCE MAX 1 @price AS hi
REDUCE QUANTILE 2 @price 0.95 AS p95
REDUCE TOLIST 1 @model AS models             # collect into a list
REDUCE FIRST_VALUE 1 @model BY @price DESC AS top_model
```

## Counting tokens, not fields

The most frequent class of `FT.AGGREGATE` parse errors is treating `<nargs>` as "number of semantic fields" when Redis counts *tokens that follow*. Same root cause, four shapes.

**Every pipeline field reference starts with `@`.** The `@` is part of the field token in `LOAD`, `GROUPBY`, `SORTBY`, `APPLY`, and `FILTER` — not just in the query string. Inside expressions like `@field >= 5` or `substr(@date, 0, 4)`, the `@` is still required.

```
# Bad: missing @ on pipeline field references
GROUPBY 1 category                       # "Unknown property 'category'. Did you mean '@category'?"
APPLY substr(date, 0, 4) AS year         # "Unknown symbol 'date'"
FILTER "date >= '2022-01'"               # "Unknown symbol 'date'"

# Good
GROUPBY 1 @category
APPLY substr(@date, 0, 4) AS year
FILTER "@date >= '2022-01'"
```

**`REDUCE` always follows a `GROUPBY`. For a whole-result aggregate, use `GROUPBY 0`.**

```
# Bad: REDUCE without a preceding GROUPBY — "Unknown argument 'REDUCE' at position 1"
FT.AGGREGATE idx:bicycle "@type:{mountain}" REDUCE AVG 1 @price AS avg_price DIALECT 2

# Good: single-row aggregate over all matched docs
FT.AGGREGATE idx:bicycle "@type:{mountain}"
    GROUPBY 0
        REDUCE AVG 1 @price AS avg_price
    DIALECT 2
```

**`REDUCE COUNT 0` — the `0` is mandatory even though `COUNT` takes no args.** `<nargs>` is the count of arguments to the reducer, regardless of whether the reducer "really" needs any.

```
# Bad: "Bad arguments for COUNT: could not convert ..."
GROUPBY 0 REDUCE COUNT AS count

# Good
GROUPBY 0 REDUCE COUNT 0 AS count
```

**`LOAD <n>` also counts tokens, not fields. `path AS alias` = 3 tokens.** Same counting rule as `RETURN`. An aliased JSONPath (`$.path AS alias`) needs nargs=3; an unaliased load needs nargs=1.

```
# Bad: nargs=1 but the LOAD has 3 tokens — "Unknown argument 'AS' at position 4"
LOAD 1 $.beers[?(@.abv >= 0.07)] AS match
LOAD 1 $.brewery_id AS brewery_id

# Good: 1 aliased path = 3 tokens
LOAD 3 $.beers[?(@.abv >= 0.07)] AS match

# Good: 2 unaliased + 1 aliased = 2 + 3 = 5 tokens
LOAD 5 @date @subject $.event.ts AS ts
```

**`SORTBY <n>` counts tokens, not fields. Each sort entry is `@field ASC|DESC` = 2 tokens. Always supply `ASC` or `DESC`.**

```
# Bad: SORTBY 1 @count DESC — Redis consumes 1 token, then "Unknown argument 'DESC'"
SORTBY 1 @count DESC

# Bad: SORTBY 2 @brand DESC @price ASC — said 2, gave 4, trailing tokens become unknown args
SORTBY 2 @brand DESC @price ASC

# Good: one sort entry = 2 tokens
SORTBY 2 @count DESC

# Good: two sort entries = 4 tokens
SORTBY 4 @count DESC @brand ASC
```

A single pipeline can contain at most **one** `SORTBY` step ("Multiple SORTBY steps are not allowed"). For a secondary sort, extend the same token list rather than writing two `SORTBY` clauses.

**For top-N, prefer `SORTBY … MAX N` over a trailing `LIMIT 0 N`.** `MAX` lives inside `SORTBY`, is more efficient, and does not compose with `LIMIT` — pick one.

```
# Good (preferred): in-sort limit
SORTBY 2 @count DESC MAX 5

# Equivalent but less efficient
SORTBY 2 @count DESC
    LIMIT 0 5

# Bad: combining MAX and LIMIT — redundant; pick one
SORTBY 2 @count DESC MAX 5 LIMIT 0 5
```

## FILTER and LOAD discipline

Pipeline `FILTER` operates on *pipeline rows*, which only contain attributes that were declared `SORTABLE` in the schema (auto-projected) or explicitly `LOAD`ed. Plain TEXT/TAG fields are not auto-projected.

**Prefer query-string filters over pipeline `FILTER` whenever possible.** The query string runs against the index; pipeline `FILTER` runs after candidates are materialized.

```
# Bad: FILTER on a TEXT field that wasn't loaded — "Unknown symbol 'date'"
FT.AGGREGATE idx:observations "@code:\"heart rate\""
    GROUPBY 0 REDUCE COUNT 0 AS count
    FILTER "@date >= '2023-01-01'"
    DIALECT 2

# Good: express the date filter in the query string (it hits the index directly)
FT.AGGREGATE idx:observations "@date:2023* @code:\"heart rate\""
    GROUPBY 0 REDUCE COUNT 0 AS count
    DIALECT 2

# Also valid: LOAD the field first, then FILTER on it in the pipeline
FT.AGGREGATE idx:observations "@code:\"heart rate\""
    LOAD 1 @date
    FILTER "@date >= '2023-01-01'"
    GROUPBY 0 REDUCE COUNT 0 AS count
    DIALECT 2
```

**Downstream stages must reference the exact alias that was `LOAD`ed.** Loading a JSONPath without `AS` projects it under the path string, not its basename.

```
# Bad: loaded $.subject, then referenced @timestamp
#       → "Property '@timestamp' not loaded nor in schema"
LOAD 1 $.subject
SORTBY 2 @timestamp DESC

# Good: load every alias you'll reference; rename with AS when needed
LOAD 2 @date @subject
SORTBY 2 @date DESC

# Good: explicit AS for a nested JSONPath
LOAD 2 $.subject AS subject $.event.ts AS ts
SORTBY 2 @ts DESC
```

**Nested JSON array predicates.** For "how many parents have at least one child matching X," use a JSONPath predicate + `exists`:

```
# How many breweries have at least one beer with ABV >= 0.07?
FT.AGGREGATE idx:breweries "*"
    LOAD 1 $.beers[?(@.abv >= 0.07)] AS match
    FILTER "exists(@match)"
    GROUPBY 0 REDUCE COUNT 0 AS qualifying_breweries
    DIALECT 2
```

## Reducer by intent

Match the reducer to the *shape* of the question.

```
# "how many"                  → GROUPBY 0 REDUCE COUNT 0 AS n
# "how many distinct X"       → GROUPBY 1 @x  GROUPBY 0 REDUCE COUNT 0 AS n
#                                (or single-step: REDUCE COUNT_DISTINCT 1 @x AS n)
# "list distinct X"           → GROUPBY 0 REDUCE TOLIST 1 @x AS list
# "sum / total"               → REDUCE SUM 1 @field AS total
# "average per Y"             → GROUPBY 1 @y REDUCE AVG 1 @field AS avg
# "top row by stat"           → REDUCE FIRST_VALUE 4 @other_field BY @stat DESC AS top
# "p95 / quantile"            → REDUCE QUANTILE 2 @field 0.95 AS p95
# "min / max within group"    → REDUCE MIN 1 @field  /  REDUCE MAX 1 @field
```

## Multi-step pipeline patterns

These compose multiple `GROUPBY` + `REDUCE` steps. The pipeline is sequential: each stage's output becomes the next stage's input, so the order of stages matters and the field names must thread through.

**Top-N per group (per-group count, then global sort + cap).** "Top N most frequent X per Y" — group by both first, then re-group by Y and pick the top X.

```
# Q: "Top brand per state by bike count"
FT.AGGREGATE idx:bicycle "*"
    GROUPBY 2 @state @brand
        REDUCE COUNT 0 AS cnt
    GROUPBY 1 @state
        REDUCE FIRST_VALUE 4 @brand BY @cnt DESC AS top_brand
        REDUCE MAX 1 @cnt AS top_cnt
    SORTBY 2 @top_cnt DESC
    DIALECT 2
```

**Distinct values with their counts (single group + count).** Two-column return: the value and how many docs have it.

```
# Q: "How many bikes per category"
FT.AGGREGATE idx:bicycle "*"
    GROUPBY 1 @category
        REDUCE COUNT 0 AS n
    SORTBY 2 @n DESC
    DIALECT 2
```

**Count distinct (two-stage)** — when you need *how many unique values*, not a per-value list. The first `GROUPBY` collapses duplicates; the second counts the resulting rows.

```
# Q: "How many distinct brands sell mountain bikes?"
FT.AGGREGATE idx:bicycle "@type:{mountain}"
    GROUPBY 1 @brand
    GROUPBY 0 REDUCE COUNT 0 AS distinct_brand_count
    DIALECT 2
```

**Bucket-by-derived-field (APPLY before GROUPBY).** When the bucket isn't a stored field — extract it with `APPLY`, then group on the alias.

```
# Q: "Bites per year"
FT.AGGREGATE idx:bites "*"
    LOAD 1 @DateOfBite
    APPLY year(@DateOfBite) AS year
    GROUPBY 1 @year REDUCE COUNT 0 AS n
    SORTBY 2 @year ASC
    DIALECT 2
```

**Filter-after-derive (year extraction + filter).** When the question is "in YEAR X" but the field is a timestamp — `APPLY year(@ts) AS year` then `FILTER "@year == X"`. Don't try to express this in the query string; the query DSL has no `year()`.

```
# Q: "How many bites in 2016 by breed"
FT.AGGREGATE idx:bites "@Breed:rottweiler"
    LOAD 1 @DateOfBite
    APPLY year(@DateOfBite) AS year
    FILTER "@year == 2016"
    GROUPBY 0 REDUCE COUNT 0 AS n
    DIALECT 2
```

**Multi-stage rule:** every stage produces a flat row of `(name, value)` pairs. Downstream stages only see names that earlier stages emitted — either a `LOAD`ed field, a `GROUPBY` key, a `REDUCE … AS alias`, or an `APPLY … AS alias`. Reference fields via their *current* alias, not the source path.

## APPLY functions

`APPLY` accepts a fixed allowlist of math, string, and time functions. **`round`, `now()`, and `date()` do not exist** — invoking them returns `Unknown function name`.

| Category | Functions |
|----------|-----------|
| Math | `ceil`, `floor`, `abs`, `log`, `exp`, `sqrt`, `pow`, `mod` |
| String | `substr`, `format`, `upper`, `lower`, `matched_terms`, `contains`, `startswith`, `strlen` |
| Time | `parse_time`, `day`, `month`, `year`, `monthofyear`, `dayofweek`, `dayofmonth`, `dayofyear`, `hour`, `minute`, `timefmt` |
| Geo | `geodistance` |

**No `round` — emulate via `floor` / `ceil`.**

```
# Round @weight to 2 decimal places
APPLY floor(@weight * 100) / 100 AS weight_rounded
```

**`substr(s, start, length)` — 0-indexed start, length is the number of characters to take (not the end position).** ISO dates `YYYY-MM-DD`:

```
APPLY substr(@date, 0, 4) AS year      # YYYY
APPLY substr(@date, 5, 2) AS month     # MM
APPLY substr(@date, 8, 2) AS day       # DD
APPLY substr(@date, 0, 7) AS yyyy_mm   # YYYY-MM
```

**`contains` for TEXT substring filtering** — the query-string form `-@field:value` does *not* negate substrings on TEXT. Use `contains` in a pipeline `FILTER`:

```
# "Cities NOT containing 'ile'"
FT.AGGREGATE idx:cities "*"
    LOAD 1 @city
    FILTER "!contains(@city, 'ile')"
    DIALECT 2
```

**Incorrect:** Filtering *after* grouping when you meant to filter the source rows; mismatched `n` count on `GROUPBY`/`SORTBY`; loading every field "just in case."

```
# Bad: FILTER after GROUPBY filters group rows, not source rows.
# Intent was "only new bikes," but here you keep all groups and trim brand rows by mean price.
FT.AGGREGATE idx:bicycle "*"
    GROUPBY 1 @brand REDUCE AVG 1 @price AS avg_price
    FILTER "@condition == 'new'"     # @condition no longer exists post-group!
    DIALECT 2

# Bad: GROUPBY count mismatched — RESP parse error or surprising grouping
FT.AGGREGATE idx:bicycle "*"
    GROUPBY 2 @brand               # said 2 fields but only listed 1
        REDUCE COUNT 0 AS n
    DIALECT 2

# Bad: LOAD * inflates the pipeline payload on every doc
FT.AGGREGATE idx:bicycle "*" LOAD * GROUPBY 1 @brand REDUCE COUNT 0 AS n DIALECT 2
```

## Client mirrors

```python
# redis-py — STEP_START aggregate_pipeline
# Mirrors doctests/query_agg.py
from redis import Redis
from redis.commands.search.aggregation import AggregateRequest
from redis.commands.search.reducers import count, avg, sort_by

r = Redis()
req = (
    AggregateRequest("@type:{mountain}")
    .load("@brand", "@price", "@condition")
    .apply(sale_price="@price * 0.9")
    .filter("@condition == 'new'")
    .group_by("@brand", count().alias("bike_count"), avg("@price").alias("avg_price"))
    .sort_by(("@avg_price", "DESC"))
    .limit(0, 5)
    .dialect(2)
)
results = r.ft("idx:bicycle").aggregate(req)
# STEP_END
```

```java
// Jedis — STEP_START aggregate_pipeline
// Mirrors QueryAggExample.java
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.aggr.AggregationBuilder;
import redis.clients.jedis.search.aggr.Reducers;
import redis.clients.jedis.search.aggr.SortedField;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    AggregationBuilder agg = new AggregationBuilder("@type:{mountain}")
        .load("@brand", "@price", "@condition")
        .apply("@price * 0.9", "sale_price")
        .filter("@condition == 'new'")
        .groupBy("@brand",
            Reducers.count().as("bike_count"),
            Reducers.avg("@price").as("avg_price"))
        .sortBy(SortedField.desc("@avg_price"))
        .limit(0, 5)
        .dialect(2);
    jedis.ftAggregate("idx:bicycle", agg);
}
// STEP_END
```

## Upstream sources

- redis-py: [`doctests/query_agg.py`](https://github.com/redis/redis-py/blob/master/doctests/query_agg.py)
- Jedis: [`QueryAggExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/QueryAggExample.java)
- Reference: [FT.AGGREGATE](https://redis.io/docs/latest/commands/ft.aggregate/), [Aggregations](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/aggregations/)
