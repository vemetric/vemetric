
# Jedis — Redis Search quick reference

This reference covers the `FT.*` (Redis Search) surface of the Jedis client. It shows how Jedis *expresses* the canonical CLI form — it does not re-explain the query DSL. Read it after a reference that already states *what* to do.

- **Query DSL vocabulary** (delimiters, operators, escaping): [`../search-syntax-primitives.md`](../search-syntax-primitives.md). Do not duplicate that grammar here.
- **redis-py (Python) equivalents** for the same operations: [`python-redis-py.md`](./python-redis-py.md).
- **RedisVL** is a Python SDK only; there is no Java equivalent. For Java targets, this is the reference.

Examples below trace to specific files in `redis/jedis/src/test/java/io/redis/examples/` and the broader Jedis test suite, preserving the upstream `STEP_START`/`STEP_END` labels so you can pair-verify against the runnable Java source — and against the matching Python steps in [`python-redis-py.md`](./python-redis-py.md). The shared **Bicycle dataset** (`bicycle:<n>` JSON docs with `brand`, `model`, `description`, `price`, `condition`, `type`, `pickup_zone`, `store_location`, `description_embeddings`) is used throughout.

**Async / reactive:** Jedis is sync-only by design. For non-blocking I/O on Redis Search, use Lettuce — out of scope for v1 of this reference.

## Table of contents

1. [Minimum supported versions](#1-minimum-supported-versions)
2. [Client class choice](#2-client-class-choice)
3. [Connection setup](#3-connection-setup)
4. [Schema imports](#4-schema-imports)
5. [Create index — HASH](#5-create-index--hash)
6. [Create index — JSON](#6-create-index--json)
7. [FT.SEARCH idioms](#7-ftsearch-idioms)
8. [FT.AGGREGATE idioms](#8-ftaggregate-idioms)
9. [Cursors](#9-cursors)
10. [Vector queries](#10-vector-queries)
11. [FT.HYBRID](#11-fthybrid)
12. [Debugging](#12-debugging)
13. [Index management](#13-index-management)
14. [Common errors & version gotchas](#14-common-errors--version-gotchas)
15. [Upstream examples index](#15-upstream-examples-index)


## 1. Minimum supported versions

redis-py equivalent: see [`python-redis-py.md#1-minimum-supported-versions`](./python-redis-py.md#1-minimum-supported-versions).

| Component | Minimum | Notes |
|-----------|---------|-------|
| Jedis | **5.0** | 4.x predates the `redis.clients.jedis.search.schemafields.*` package and the fluent `SchemaField[]` API. Examples in this reference will not compile against 4.x. |
| Jedis (FT.HYBRID high-level API) | **6.0** | `ftHybrid` / `FTHybridParams` are not in Jedis 5.x — fall back to `sendCommand(SearchCommand.HYBRID, ...)` (see §11). |
| Redis server (FT.SEARCH / FT.AGGREGATE) | **7.4** | Redis Search ships built-in from Redis 8.0; on 7.4 the RediSearch module must be loaded. |
| Redis server (`FT.HYBRID`) | **8.4.0** | Hard floor. `ftHybrid` returns `JedisDataException: unknown command 'FT.HYBRID'` on older Redis. Fall back to pre-filter + `=>[KNN ...]` via FT.SEARCH. |
| Java | 8+ | Jedis 5.x targets Java 8 baseline; 6.x targets Java 11+. |

**DIALECT default:** Jedis does **not** set DIALECT on your behalf. Every query in this reference passes DIALECT 2 explicitly via `FTSearchParams.searchParams().dialect(2)` or `AggregationBuilder.dialect(2)`. GEOSHAPE `WITHIN`/`CONTAINS` predicates require DIALECT 3.


## 2. Client class choice

redis-py has a single client class (`redis.Redis`); no equivalent client-choice section — see [`python-redis-py.md#2-connection-setup`](./python-redis-py.md#2-connection-setup) for how the single class is constructed.

Jedis has accumulated several entry points. Pick **one** per project and stay consistent — mixing them in the same codebase forces conversions and confuses readers.

| Class | Use when… | Threading | Notes |
|-------|-----------|-----------|-------|
| `RedisClient` | **Current upstream default.** All examples under `redis/jedis/src/test/java/io/redis/examples` use this. Constructed via `RedisClient.create("redis://localhost:6379")`. | Internal pool; safe to share across threads. | Use this for new code. |
| `UnifiedJedis` | Single sync client without a pool wrapper — useful for tests, scripts, or single-threaded callers. | Single connection; **not** thread-safe. | Parent class of `RedisClient` and `JedisPooled`; appears in internal test base classes. |
| `JedisPooled` | Pre-`RedisClient` recommended pooled client. Still widely used in existing apps. | Internal `JedisPool`; thread-safe. | Functionally equivalent to `RedisClient` for FT.* calls. Don't rewrite working `JedisPooled` code just to swap names. |
| `Jedis` (legacy) | A single raw connection, the original 4.x-era API. | One connection; **not** thread-safe. Must be returned to a pool or `close()`'d per use. | Avoid in new code. Many community blog posts still show this pattern. |
| `JedisCluster` | Redis Cluster. | Cluster-aware pool. | FT.* indexes are not sharded across cluster slots — see Redis Search cluster docs before using. |

**Migration path:** `Jedis` → `JedisPooled` (same API + connection management) → `RedisClient` (same API, current upstream name). All three accept the same `ftSearch`, `ftCreate`, `ftAggregate` etc. methods, so migration is mostly a constructor swap.

**Divergence to flag:** upstream Jedis examples (`SearchQuickstartExample.java`) use `RedisClient.create("localhost", 6379)` while most public-internet blog posts and older Redis docs still show `UnifiedJedis` or `JedisPooled`. If you're porting code from those sources, the FT.* method names are identical — only the construction line differs.


## 3. Connection setup

redis-py equivalent: see [`python-redis-py.md#2-connection-setup`](./python-redis-py.md#2-connection-setup).

The canonical connect, from `SearchQuickstartExample.java` — STEP_START `connect`:

```java
import redis.clients.jedis.RedisClient;

RedisClient jedis = RedisClient.create("localhost", 6379);
// or, URI form (used in QueryFtExample.java, QueryEmExample.java, etc.):
RedisClient jedis2 = RedisClient.create("redis://localhost:6379");
```

`RedisClient` carries an internal pool and is safe to share across threads. Use it as a long-lived field; do not create one per request. Always `close()` it at application shutdown (or use try-with-resources for short-lived scripts):

```java
try (RedisClient jedis = RedisClient.create("redis://localhost:6379")) {
    // FT.* calls here
}
```

For TLS / auth, prefer the URI form: `redis://user:password@host:6379` or `rediss://...` for TLS. Configuration of pool size, timeouts, and SSL contexts goes through `DefaultJedisClientConfig.builder()` — out of scope here, see Jedis docs.


## 4. Schema imports

redis-py equivalent: see [`python-redis-py.md#3-schema-imports`](./python-redis-py.md#3-schema-imports).

The canonical Jedis import block for FT.* code, mirroring `SearchQuickstartExample.java` and `HomeJsonExample.java` STEP_START `import`:

```java
import redis.clients.jedis.RedisClient;
import redis.clients.jedis.exceptions.JedisDataException;
import redis.clients.jedis.json.Path2;
import redis.clients.jedis.search.*;                 // Query, SearchResult, Document,
                                                     // FTCreateParams, FTSearchParams,
                                                     // IndexDataType, RediSearchUtil
import redis.clients.jedis.search.schemafields.*;    // TextField, TagField, NumericField,
                                                     // GeoField, GeoShapeField, VectorField
import redis.clients.jedis.search.aggr.*;            // AggregationBuilder, AggregationResult,
                                                     // Reducers, SortedField, Row, Group
import redis.clients.jedis.args.SortingOrder;        // ASC / DESC
```

For FT.HYBRID (Redis ≥ 8.4.0, Jedis ≥ 6.0):

```java
import redis.clients.jedis.search.Combiners;
import redis.clients.jedis.search.Scorers;
import redis.clients.jedis.search.hybrid.FTHybridParams;
import redis.clients.jedis.search.hybrid.FTHybridSearchParams;
import redis.clients.jedis.search.hybrid.FTHybridVectorParams;
import redis.clients.jedis.search.hybrid.FTHybridPostProcessingParams;
import redis.clients.jedis.search.hybrid.HybridResult;
```

Notes:

- The schema field classes live under `redis.clients.jedis.search.schemafields.*` — not `redis.clients.jedis.search.*`. Star-importing only `redis.clients.jedis.search.*` will miss them and produce confusing "cannot find symbol `TextField`" errors.
- **Use `SchemaField[]` (the modern API) — not the deprecated `Schema` class.** `Schema sc = new Schema().addTextField(...)` still appears in older test bases and pre-5.0 docs; treat it as legacy. See §14 for the migration.
- **Use `Path2` — not `Path`.** Both exist; `Path2` is the current one for `FT.*` JSON paths and `jsonSet` calls. All upstream examples use `Path2`.


## 5. Create index — HASH

redis-py equivalent: see [`python-redis-py.md#4-create-index--hash`](./python-redis-py.md#4-create-index--hash).

CLI form (from [`index-creation.md`](../index-creation.md)):

```
FT.CREATE idx:bicycle ON HASH PREFIX 1 bicycle:
    SCHEMA
        model        TEXT WEIGHT 2.0
        description  TEXT
        brand        TAG
        condition    TAG
        price        NUMERIC SORTABLE
        store_location GEO
```

Jedis — mirrors `HomeJsonExample.java` STEP_START `make_hash_index` (the upstream HASH-index example; the JSON variant is in §6):

```java
// STEP_START create_index_hash
SchemaField[] schema = {
    TextField.of("model").weight(2.0),
    TextField.of("description"),
    TagField.of("brand"),
    TagField.of("condition"),
    NumericField.of("price").sortable(),
    GeoField.of("store_location")
};

jedis.ftCreate("idx:bicycle",
    FTCreateParams.createParams()
        .on(IndexDataType.HASH)
        .addPrefix("bicycle:"),
    schema
);
// STEP_END
```

HASH-specific notes:

- Field names in the schema are the **hash field names verbatim** — no `$.` path, no `.as("alias")` call. The schema field's name *is* the alias.
- Document keys must literally start with the declared prefix (`bicycle:1`, `bicycle:2`, …). An empty / missing prefix indexes every hash in the database.
- Write documents with `jedis.hset("bicycle:1", Map.of(...))` — indexing happens synchronously on the write.


## 6. Create index — JSON

redis-py equivalent: see [`python-redis-py.md#5-create-index--json`](./python-redis-py.md#5-create-index--json).

CLI form:

```
FT.CREATE idx:bicycle ON JSON PREFIX 1 bicycle:
    SCHEMA
        $.brand        AS brand        TEXT
        $.model        AS model        TEXT
        $.description  AS description  TEXT
        $.price        AS price        NUMERIC
        $.condition    AS condition    TAG
```

Jedis — mirrors `SearchQuickstartExample.java` STEP_START `create_index`:

```java
// STEP_START create_index_json
SchemaField[] schema = {
    TextField.of("$.brand").as("brand"),
    TextField.of("$.model").as("model"),
    TextField.of("$.description").as("description"),
    NumericField.of("$.price").as("price"),
    TagField.of("$.condition").as("condition")
};

jedis.ftCreate("idx:bicycle",
    FTCreateParams.createParams()
        .on(IndexDataType.JSON)
        .addPrefix("bicycle:"),
    schema
);
// STEP_END
```

JSON-specific notes:

- `TextField.of("$.brand")` takes the **JSONPath**, not the alias. Always pair it with `.as("brand")`; the alias is what queries reference as `@brand`.
- Without `.as(...)`, Redis auto-generates an alias from the path — usable but brittle (renaming the JSON key silently breaks the index).
- Array projections: `TextField.of("$.tags[*]").as("tags")`. Nested objects: `TextField.of("$.address.city").as("city")`.
- Add documents with `jedis.jsonSet("bicycle:1", Path2.ROOT_PATH, bicycleJson)` or `jsonSetWithEscape(...)` for a POJO that needs JSON-string-value escaping (used in `SearchQuickstartExample.java` STEP_START `add_documents`).


## 7. FT.SEARCH idioms

redis-py equivalent: see [`python-redis-py.md#6-ftsearch-idioms`](./python-redis-py.md#6-ftsearch-idioms).

For the query DSL itself (delimiters, operators, escaping), read [`../search-syntax-primitives.md`](../search-syntax-primitives.md). This section shows only how Jedis *binds* a query to `FT.SEARCH`.

### Two call shapes

Jedis exposes two overloads:

```java
// String-only — convenient for simple queries.
SearchResult res = jedis.ftSearch("idx:bicycle", "@condition:{new}");

// String + FTSearchParams — the full surface (filters, dialect, sort, return fields, paging).
SearchResult res2 = jedis.ftSearch("idx:bicycle",
    "@condition:{new}",
    FTSearchParams.searchParams()
        .returnFields("brand", "model", "price")
        .sortBy("price", SortingOrder.ASC)
        .limit(0, 10)
        .dialect(2)
);

// Legacy: Query object (still supported; FTSearchParams is the modern path).
Query q = new Query("@condition:{new}").returnFields("brand").dialect(2);
SearchResult res3 = jedis.ftSearch("idx:bicycle", q);
```

`FTSearchParams.searchParams()` is the modern fluent path used across all current upstream examples (`QueryRangeExample.java`, `QueryGeoExample.java`, `QueryEmExample.java`). Use it for new code; the `Query` class still works and is preserved for backward compatibility.

| `FTSearchParams` method | CLI equivalent | Purpose |
|-------------------------|----------------|---------|
| `.limit(offset, num)` | `LIMIT offset num` | Result page slice. |
| `.sortBy(field, SortingOrder.ASC)` | `SORTBY field ASC\|DESC` | Override score-based ranking. Requires the field declared `.sortable()` at index time. |
| `.returnFields(f1, f2, ...)` | `RETURN n f1 f2 ...` | Project only listed fields. |
| `.noContent()` | `NOCONTENT` | IDs only — pair with `LIMIT 0 0` for count-only queries. |
| `.withScores()` | `WITHSCORES` | Append per-doc relevance score. |
| `.verbatim()` | `VERBATIM` | Disable stemming. |
| `.dialect(2)` | `DIALECT 2` | **Always pass this.** |
| `.filter("field", min, max)` | `FILTER field min max` | Inline numeric range; alternative to `@field:[min max]` in the expression. |
| `.addParam("name", value)` | `PARAMS n name value …` | Bind `$name` placeholders in the expression. |

### Exact match (TAG / NUMERIC) — mirrors `QueryEmExample.java`

```java
// STEP_START em1 — numeric exact match via range with equal bounds
SearchResult res1 = jedis.ftSearch("idx:bicycle", "@price:[270 270]");
// Equivalent via FILTER (no inline range):
SearchResult res2 = jedis.ftSearch("idx:bicycle", "*",
    FTSearchParams.searchParams().filter("price", 270, 270));

// STEP_START em2 — tag exact match
SearchResult res3 = jedis.ftSearch("idx:bicycle", "@condition:{new}");

// STEP_START em4 — exact phrase in TEXT
SearchResult res5 = jedis.ftSearch("idx:bicycle", "@description:\"rough terrain\"");
```

### Numeric ranges — mirrors `QueryRangeExample.java`

```java
// STEP_START range1 — inclusive
SearchResult res1 = jedis.ftSearch("idx:bicycle", "@price:[500 1000]",
    FTSearchParams.searchParams().returnFields("price").dialect(2));

// STEP_START range3 — exclusive lower, unbounded upper, via FTSearchParams.filter
SearchResult res3 = jedis.ftSearch("idx:bicycle", "*",
    FTSearchParams.searchParams()
        .returnFields("price")
        .filter("price", 1000, true, Double.POSITIVE_INFINITY, false)
        .dialect(2));

// STEP_START range4 — sorted + paged
SearchResult res4 = jedis.ftSearch("idx:bicycle", "@price:[-inf 2000]",
    FTSearchParams.searchParams()
        .returnFields("price")
        .sortBy("price", SortingOrder.ASC)
        .limit(0, 5)
        .dialect(2));
```

`.filter(field, min, minExclusive, max, maxExclusive)` is Jedis's typed equivalent of `"@price:[(1000 +inf]"`. Pass `Double.POSITIVE_INFINITY` / `Double.NEGATIVE_INFINITY` for unbounded ends.

### Full-text idioms — mirrors `QueryFtExample.java`

```java
// STEP_START ft1 — field-scoped term
SearchResult res1 = jedis.ftSearch("idx:bicycle", "@description: kids");

// STEP_START ft2 — prefix
SearchResult res2 = jedis.ftSearch("idx:bicycle", "@model: ka*");

// STEP_START ft3 — suffix (requires WITHSUFFIXTRIE at index time for efficiency)
SearchResult res3 = jedis.ftSearch("idx:bicycle", "@brand: *bikes");

// STEP_START ft4 — fuzzy (Levenshtein distance 1)
SearchResult res4 = jedis.ftSearch("idx:bicycle", "%optamized%");

// STEP_START ft5 — fuzzy distance 2 (double % per side)
SearchResult res5 = jedis.ftSearch("idx:bicycle", "%%optamised%%");
```

### Geo — mirrors `QueryGeoExample.java`

```java
// STEP_START geo1 — radius query, parameterised
SearchResult res1 = jedis.ftSearch("idx:bicycle",
    "@store_location:[$lon $lat $radius $units]",
    FTSearchParams.searchParams()
        .addParam("lon", -0.1778)
        .addParam("lat", 51.5524)
        .addParam("radius", 20)
        .addParam("units", "mi")
        .dialect(2));

// STEP_START geo2 — GEOSHAPE CONTAINS (requires DIALECT 3)
SearchResult res2 = jedis.ftSearch("idx:bicycle",
    "@pickup_zone:[CONTAINS $bike]",
    FTSearchParams.searchParams()
        .addParam("bike", "POINT(-0.1278 51.5074)")
        .dialect(3));

// STEP_START geo3 — GEOSHAPE WITHIN polygon
SearchResult res3 = jedis.ftSearch("idx:bicycle",
    "@pickup_zone:[WITHIN $europe]",
    FTSearchParams.searchParams()
        .addParam("europe", "POLYGON((-25 35, 40 35, 40 70, -25 70, -25 35))")
        .dialect(3));
```

Note that GEOSHAPE fields need `GeoShapeField.of("$.pickup_zone", GeoShapeField.CoordinateSystem.FLAT).as("pickup_zone")` in the schema (see `QueryGeoExample.java`).

### Reading results

`SearchResult` exposes:

```java
res.getTotalResults();              // server-reported match count (long)
res.getDocuments();                 // List<Document>

for (Document doc : res.getDocuments()) {
    doc.getId();                    // "bicycle:0"
    doc.getScore();                 // double, when .withScores() was set
    doc.getString("brand");         // typed field access
    doc.get("price");               // raw Object value
    doc.hasProperty("price");       // existence check
}
```

For HASH indexes, field values come back as `String`. For JSON indexes without `.returnFields(...)`, Jedis returns the whole JSON document under the `$` property (see `SearchQuickstartExample.java` STEP_START `query_single_term` output comments).


## 8. FT.AGGREGATE idioms

redis-py equivalent: see [`python-redis-py.md#7-ftaggregate-idioms`](./python-redis-py.md#7-ftaggregate-idioms).

For pipeline-stage ordering rules, see [`aggregate-pipeline.md`](../aggregate-pipeline.md). This section shows only the Jedis builder shape.

### The `AggregationBuilder`

`AggregationBuilder("<filter-expression>")` is Jedis's `FT.AGGREGATE` shape, separate from `Query`. Fluent setters map directly to pipeline stages:

| `AggregationBuilder` method | CLI stage |
|-----------------------------|-----------|
| `.load(field1, field2, ...)` | `LOAD n f1 f2 ...` |
| `.apply("<expr>", "alias")` | `APPLY <expr> AS alias` (note: expression first, alias second — opposite of redis-py's keyword form) |
| `.filter("<expr>")` | `FILTER <expr>` |
| `.groupBy("@field", Reducers.X.as("alias"))` | `GROUPBY n field REDUCE ...` |
| `.sortBy(SortedField.asc("@field"))` / `.sortBy(n, SortedField.desc("@field"))` | `SORTBY n <field> ASC\|DESC` |
| `.limit(offset, num)` | `LIMIT offset num` |
| `.cursor(count, maxIdleMs)` | `WITHCURSOR [COUNT n] [MAXIDLE ms]` (see §9) |
| `.dialect(2)` | `DIALECT 2` |

Reducers live in `redis.clients.jedis.search.aggr.Reducers` as static factory methods. Common ones:

| Factory | CLI form |
|---------|----------|
| `Reducers.count()` | `REDUCE COUNT 0` |
| `Reducers.count_distinct("@f")` | `REDUCE COUNT_DISTINCT 1 @f` |
| `Reducers.sum("@f")` | `REDUCE SUM 1 @f` |
| `Reducers.avg("@f")` | `REDUCE AVG 1 @f` |
| `Reducers.min("@f")` / `Reducers.max("@f")` | `REDUCE MIN 1 @f` / `MAX 1 @f` |
| `Reducers.quantile("@f", 0.95)` | `REDUCE QUANTILE 2 @f 0.95` |
| `Reducers.to_list("@f")` | `REDUCE TOLIST 1 @f` |

Every reducer takes `.as("alias")` to set the `AS <alias>` token.

### Worked pipeline — mirrors `QueryAggExample.java`

```java
// STEP_START agg1 — LOAD + APPLY (no grouping)
AggregationResult res1 = jedis.ftAggregate("idx:bicycle",
    new AggregationBuilder("@condition:{new}")
        .load("__key", "price")
        .apply("@price - (@price * 0.1)", "discounted")
        .dialect(2));
// Rows: {__key=bicycle:0, discounted=243, price=270}, ...

// STEP_START agg2 — APPLY + GROUPBY + REDUCE
AggregationResult res2 = jedis.ftAggregate("idx:bicycle",
    new AggregationBuilder("*")
        .load("price")
        .apply("@price<1000", "price_category")
        .groupBy("@condition", Reducers.sum("@price_category").as("num_affordable"))
        .dialect(2));

// STEP_START agg3 — synthesised group key via APPLY
AggregationResult res3 = jedis.ftAggregate("idx:bicycle",
    new AggregationBuilder("*")
        .apply("'bicycle'", "type")
        .groupBy("@type", Reducers.count().as("num_total"))
        .dialect(2));
// Rows: {type=bicycle, num_total=10}

// STEP_START agg4 — GROUPBY + TOLIST
AggregationResult res4 = jedis.ftAggregate("idx:bicycle",
    new AggregationBuilder("*")
        .load("__key")
        .groupBy("@condition", Reducers.to_list("__key").as("bicycles"))
        .dialect(2));
```

Result shape: `AggregationResult.getRows()` returns `List<Row>`. Per row:

```java
Row r = res2.getRows().get(0);
r.getString("condition");       // "new"
r.getLong("num_affordable");    // 3
r.getDouble("avg_price");       // when applicable
r.get("bicycles");              // raw value for TOLIST (ArrayList<String>)
```

**Argument order gotcha:** `.apply(expression, alias)` puts the expression *first*. redis-py uses the opposite order via keyword: `apply(discounted="@price * 0.9")` — keyword *is* the alias. When porting from Python, swap.


## 9. Cursors

redis-py equivalent: see [`python-redis-py.md#8-cursors`](./python-redis-py.md#8-cursors).

For lifecycle rules and when to use cursors, see [`aggregate-cursors.md`](../aggregate-cursors.md).

CLI form:

```
FT.AGGREGATE idx:bicycle "*"
    GROUPBY 1 @brand REDUCE COUNT 0 AS n
    WITHCURSOR COUNT 1000 MAXIDLE 30000
    DIALECT 2

FT.CURSOR READ idx:bicycle <cursor_id> COUNT 1000
FT.CURSOR DEL  idx:bicycle <cursor_id>
```

Jedis — open a cursor (`AggregationCommandsTestBase.java` STEP_START `cursor`):

```java
// STEP_START aggregate_cursor_open
AggregationBuilder ab = new AggregationBuilder("*")
    .groupBy("@brand", Reducers.count().as("n"))
    .sortBy(10, SortedField.desc("@n"))
    .cursor(1000, 30000)            // COUNT 1000, MAXIDLE 30000 ms
    .dialect(2);

AggregationResult page = jedis.ftAggregate("idx:bicycle", ab);
long cursorId = page.getCursorId();
// STEP_END
```

Read subsequent pages:

```java
// STEP_START aggregate_cursor_read
while (cursorId != 0) {             // 0 signals exhausted server-side cursor
    page = jedis.ftCursorRead("idx:bicycle", cursorId, 1000);
    cursorId = page.getCursorId();
    process(page.getRows());
}
// STEP_END
```

Explicit cleanup (release before MAXIDLE):

```java
// STEP_START aggregate_cursor_del
jedis.ftCursorDel("idx:bicycle", cursorId);
// STEP_END
```

**Higher-level helper.** Jedis also exposes `ftAggregateIteration(...)` which encapsulates the cursor loop and exposes `nextBatch()` / `collect(...)`, mirroring `AggregationCommandsTestBase.java` `aggregateIteration` test:

```java
FtAggregateIteration it = jedis.ftAggregateIteration("idx:bicycle", ab);
while (!it.isIterationCompleted()) {
    AggregationResult batch = it.nextBatch();
    process(batch.getRows());
}
```

Use the helper for straightforward "drain to the end" cases; fall back to manual `ftCursorRead` / `ftCursorDel` when you need per-batch flow control or explicit cleanup on cancellation.


## 10. Vector queries

redis-py equivalent: see [`python-redis-py.md#9-vector-queries`](./python-redis-py.md#9-vector-queries).

For query-attribute syntax (`=>[KNN ...]`, `[VECTOR_RANGE ...]`) and pre-filter shape, read [`vector-query.md`](../vector-query.md).

**Note on upstream sourcing.** `VectorSetExample.java` in `redis/jedis/src/test/java/io/redis/examples` demonstrates the Redis **Vector Set** data type (`VADD`, `VSIM`) — a separate feature, **not** FT.* vector indexing. The canonical FT.* vector tests live in `redis/jedis/src/test/java/redis/clients/jedis/commands/unified/search/SearchWithParamsCommandsTestBase.java` (methods `testHNSWVectorSimilarity`, `testFlatVectorSimilarity`, `vectorSearchProfile`). Examples below mirror those.

### Index a vector field

CLI form:

```
FT.CREATE idx:bicycle ON JSON PREFIX 1 bicycle: SCHEMA
    ...
    $.description_embeddings AS vector VECTOR FLAT 6
        TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE
```

Jedis — mirrors `SearchWithParamsCommandsTestBase.java` `testHNSWVectorSimilarity` adapted to the bicycle schema (dim 1536 matches OpenAI `text-embedding-3-small` / `ada-002`):

```java
// STEP_START create_vector_index
import redis.clients.jedis.search.schemafields.VectorField;
import redis.clients.jedis.search.schemafields.VectorField.VectorAlgorithm;

int VECTOR_DIMENSION = 1536;        // match your embedding model

Map<String, Object> vectorAttrs = new HashMap<>();
vectorAttrs.put("TYPE", "FLOAT32");
vectorAttrs.put("DIM", VECTOR_DIMENSION);
vectorAttrs.put("DISTANCE_METRIC", "COSINE");

SchemaField[] schema = {
    TextField.of("$.model").noStem().as("model"),
    TextField.of("$.brand").noStem().as("brand"),
    NumericField.of("$.price").as("price"),
    TagField.of("$.type").as("type"),
    VectorField.builder()
        .fieldName("$.description_embeddings")
        .algorithm(VectorAlgorithm.FLAT)        // or HNSW for ANN
        .attributes(vectorAttrs)
        .build()
        .as("vector")
};

jedis.ftCreate("idx:bicycle",
    FTCreateParams.createParams()
        .on(IndexDataType.JSON)
        .addPrefix("bicycle:"),
    schema);
// STEP_END
```

### Encode the query vector

The de facto pattern — `float[]` → little-endian `byte[]`. Jedis ships a helper: `RediSearchUtil.toByteArray(float[])`:

```java
import redis.clients.jedis.search.RediSearchUtil;

byte[] queryBytes = RediSearchUtil.toByteArray(embedding);   // dim 1536 float[]
```

Equivalent explicit form (mirrors `FTHybridCommandsTestBase.java` `floatArrayToByteArray` and the `redis-py` convention):

```java
static byte[] floatArrayToByteArray(float[] floats) {
    ByteBuffer buf = ByteBuffer.allocate(floats.length * 4).order(ByteOrder.LITTLE_ENDIAN);
    for (float f : floats) buf.putFloat(f);
    return buf.array();
}
```

`FLOAT32` little-endian is the only encoding `redis-py` and Jedis ship with — match this on both index and query side, every time. A `double[]` (or big-endian buffer) silently produces zero hits because per-element byte offsets disagree with the index's `TYPE FLOAT32`.

### KNN — mirrors `SearchWithParamsCommandsTestBase.java` `testHNSWVectorSimilarity`

```java
// STEP_START vector_knn
FTSearchParams searchParams = FTSearchParams.searchParams()
    .addParam("query_vector", queryBytes)
    .sortBy("vector_score", SortingOrder.ASC)
    .returnFields("vector_score", "brand", "model", "description")
    .dialect(2);

SearchResult res = jedis.ftSearch("idx:bicycle",
    "(*)=>[KNN 3 @vector $query_vector AS vector_score]",
    searchParams);
// STEP_END
```

`AS vector_score` aliases the distance field — sort by it and return it just like any other field.

### Pre-filtered KNN — mirrors the `query_combined.py` shape from redis-py

```java
// STEP_START vector_prefilter  (pre-Redis-8.4 hybrid pattern — for native blended ranking see §11)
SearchResult res = jedis.ftSearch("idx:bicycle",
    "(@price:[500 1000] -@condition:{new})=>[KNN 3 @vector $query_vector AS vector_score]",
    FTSearchParams.searchParams()
        .addParam("query_vector", queryBytes)
        .sortBy("vector_score", SortingOrder.ASC)
        .returnFields("vector_score", "brand", "model", "price")
        .dialect(2));
// STEP_END
```

The pre-filter `(@price:[500 1000] -@condition:{new})` is applied **before** the KNN scan — it shrinks the candidate set HNSW/FLAT has to walk. Forgetting it is the most common cause of slow vector queries.

### Range — mirrors `SearchWithParamsCommandsTestBase.java` vector range pattern

```java
// STEP_START vector_range
SearchResult res = jedis.ftSearch("idx:bicycle",
    "@vector:[VECTOR_RANGE $range $query_vector]=>{$YIELD_DISTANCE_AS: vector_score}",
    FTSearchParams.searchParams()
        .addParam("range", 0.55)
        .addParam("query_vector", queryBytes)
        .sortBy("vector_score", SortingOrder.ASC)
        .returnFields("vector_score", "brand", "model", "description")
        .limit(0, 4)
        .dialect(2));
// STEP_END
```

`AS <alias>` (KNN form) and `$YIELD_DISTANCE_AS: <alias>` (RANGE form) are not interchangeable — the syntax differs by query type.

### HNSW tuning per-query

`EF_RUNTIME` is an in-query attribute on the KNN tail:

```java
jedis.ftSearch("idx:bicycle",
    "*=>[KNN 10 @vector $query_vector EF_RUNTIME 200 AS score]",
    FTSearchParams.searchParams().addParam("query_vector", queryBytes).dialect(2));
```

Index-time `EF_CONSTRUCTION` lives in the `VectorField` attributes map and is independent of `EF_RUNTIME`.


## 11. FT.HYBRID

redis-py equivalent: see [`python-redis-py.md#10-fthybrid`](./python-redis-py.md#10-fthybrid).

**Version gate:** `FT.HYBRID` requires Redis ≥ **8.4.0**. On older Redis use the pre-filter + KNN pattern in §10. See [`command-selection.md`](../command-selection.md) for the SEARCH vs AGGREGATE vs HYBRID decision.

**Jedis client gate:** the high-level `ftHybrid` method requires **Jedis 6.x**. Jedis 5.x users must use the `sendCommand` fallback shown at the bottom of this section.

### High-level builder

Jedis 6.x ships a high-level `ftHybrid` method backed by `FTHybridParams.builder()`. Pattern: build a `FTHybridSearchParams` (text leg) + `FTHybridVectorParams` (vector leg), combine with a `Combiners.rrf()` or `Combiners.linear()`, optionally add a `FTHybridPostProcessingParams` for `LOAD` / `GROUPBY` / `APPLY` / `SORTBY` / `FILTER` / `LIMIT` stages. Mirrors `FTHybridCommandsTestBase.java` `testComprehensiveFtHybridWithAllFeatures`:

```java
// STEP_START run_hybrid_query_native
import redis.clients.jedis.search.Combiners;
import redis.clients.jedis.search.Scorers;
import redis.clients.jedis.search.hybrid.*;
import redis.clients.jedis.search.aggr.Group;
import redis.clients.jedis.search.aggr.Reducers;
import redis.clients.jedis.search.aggr.SortedField;
import redis.clients.jedis.search.Apply;
import redis.clients.jedis.search.Filter;
import redis.clients.jedis.search.Limit;

FTHybridPostProcessingParams postProcessing = FTHybridPostProcessingParams.builder()
    .load("price", "brand", "@category")
    .groupBy(new Group("@brand")
        .reduce(Reducers.sum("@price").as("sum"))
        .reduce(Reducers.count().as("count")))
    .apply(Apply.of("@sum * 0.9", "discounted_price"))
    .sortBy(SortedField.asc("@sum"), SortedField.desc("@count"))
    .filter(Filter.of("@sum > 700"))
    .limit(Limit.of(0, 20))
    .build();

FTHybridParams hybridArgs = FTHybridParams.builder()
    .search(FTHybridSearchParams.builder()
        .query("@category:{electronics} smartphone camera")
        .scorer(Scorers.bm25std())
        .scoreAlias("text_score")
        .build())
    .vectorSearch(FTHybridVectorParams.builder()
        .field("@image_embedding")
        .vector("vector")                          // param name, bound below
        .method(FTHybridVectorParams.Knn.of(20).efRuntime(150))
        .filter("(@brand:{apple|samsung|google}) (@price:[500 1500])")
        .scoreAlias("vector_score")
        .build())
    .combine(Combiners.linear().alpha(0.7).beta(0.3).window(25))   // or Combiners.rrf().window(60)
    .postProcessing(postProcessing)
    .param("vector", queryBytes)
    .build();

HybridResult reply = jedis.ftHybrid("idx:products", hybridArgs);

reply.getTotalResults();
reply.getDocuments();             // List<Document>
reply.getExecutionTime();         // server-side timing (double, ms)
reply.getWarnings();
// STEP_END
```

### Combine methods

| Factory | CLI emitted | When to use |
|---------|-------------|-------------|
| `Combiners.rrf()` | `COMBINE RRF count [CONSTANT c] [WINDOW w]` | **Default for blended ranking.** Reciprocal Rank Fusion — rank-based, robust without weight tuning. Knobs: `.window(int)`, `.constant(double)` (typically 60). |
| `Combiners.linear()` | `COMBINE LINEAR count [ALPHA a] [BETA b] [WINDOW w]` | Weighted score blend. Needs `.alpha(double)` / `.beta(double)` tuned to your scorer scales. |

Both expose `.as("alias")` to alias the final combined score.

### Important behaviours

- `ftHybrid` is annotated `@Experimental` in Jedis. Pin your Jedis minor version if you depend on it in production; the builder API may shift between minors.
- `FTHybridSearchParams` and `FTHybridVectorParams` use different builders — the search leg owns the text query and scorer; the vector leg owns the vector field, KNN/range method, optional internal `.filter(...)` (applied before the vector scan), and per-leg `.scoreAlias(...)`.
- `FTHybridVectorParams.Knn.of(int)` sets `K`; chain `.efRuntime(int)` to tune HNSW per query.
- Vector blob is bound by name via the top-level `.param("vector", byte[])` — same `PARAMS`-binding mechanism as FT.SEARCH.
- `FTHybridPostProcessingParams.load(...)`-returned field values may come back as `byte[]` rather than `String` depending on protocol and field type — defensive callers should check with `instanceof` before casting (mirrors the `redis-py` HYBRID gotcha).

### Raw `sendCommand` fallback (Jedis 5.x or features missing from the builder)

For Jedis 5.x callers — or features that have not yet landed in the high-level builder — drop to the **binary** `sendCommand` overload. Encoding the vector through `new String(bytes, ISO_8859_1)` is lossy on RESP3 and corrupts certain byte values; pass the raw `byte[]` to `sendCommand(ProtocolCommand, byte[]...)` instead:

```java
import redis.clients.jedis.search.SearchProtocol.SearchCommand;
import redis.clients.jedis.util.SafeEncoder;

byte[] queryBytes = RediSearchUtil.toByteArray(embedding);   // FLOAT32 little-endian

// UnifiedJedis (parent of RedisClient / JedisPooled) exposes sendCommand(ProtocolCommand, byte[]...).
Object raw = ((UnifiedJedis) jedis).sendCommand(
    SearchCommand.HYBRID,
    SafeEncoder.encode("idx:products"),
    SafeEncoder.encode("SEARCH"),      SafeEncoder.encode("laptop"),
    SafeEncoder.encode("VSIM"),        SafeEncoder.encode("@description_vector"),
                                       SafeEncoder.encode("$query_vec"),
    SafeEncoder.encode("KNN"),         SafeEncoder.encode("2"),
                                       SafeEncoder.encode("K"), SafeEncoder.encode("10"),
    SafeEncoder.encode("COMBINE"),     SafeEncoder.encode("RRF"),
                                       SafeEncoder.encode("2"),
                                       SafeEncoder.encode("WINDOW"), SafeEncoder.encode("100"),
    SafeEncoder.encode("PARAMS"),      SafeEncoder.encode("2"),
                                       SafeEncoder.encode("query_vec"),
                                       queryBytes,                              // raw vector — DO NOT round-trip through String
    SafeEncoder.encode("DIALECT"),     SafeEncoder.encode("2")
);
```

Key points:

- Use `SearchCommand.HYBRID` (`redis.clients.jedis.search.SearchProtocol.SearchCommand`) rather than an ad-hoc `ProtocolCommand` anonymous class — it's the canonical enum and survives upstream renames.
- Use `((UnifiedJedis) jedis).sendCommand(ProtocolCommand, byte[]...)` (the **binary** varargs form, defined on `UnifiedJedis`). The `String...` overload silently UTF-8-encodes its arguments and **mangles vector bytes** on the wire.
- `SafeEncoder.encode(String)` is Jedis's canonical UTF-8 string→`byte[]` helper — use it for every text argument so the wire bytes match what the high-level API would emit.
- The vector `byte[]` is passed in directly; no `new String(queryBytes, ISO_8859_1)` round-trip.

The raw shape mirrors the verified syntax in spec 0001 §5.0a. Use it only when the high-level `ftHybrid` builder lacks a flag you need — and consider opening an issue upstream once you confirm the gap.

Upstream sources: `src/main/java/redis/clients/jedis/search/hybrid/FTHybridParams.java`, `src/main/java/redis/clients/jedis/search/Combiners.java`, `src/test/java/redis/clients/jedis/commands/unified/search/FTHybridCommandsTestBase.java`.


## 12. Debugging

redis-py equivalent: see [`python-redis-py.md#11-debugging`](./python-redis-py.md#11-debugging).

For interpreting `FT.EXPLAIN` and `FT.PROFILE` output, see [`debugging.md`](../debugging.md).

### `FT.EXPLAIN`

```java
// Pass either a Query object or a raw query string.
String plan = jedis.ftExplain("idx:bicycle",
    new Query("(@brand:{Velorim}) @price:[100 500]").dialect(2));
System.out.println(plan);
// INTERSECT {
//   TAG:@brand { Velorim }
//   NUMERIC {100.000000 <= @price <= 500.000000}
// }
```

The output is the server's parse tree — useful for spotting unexpected stemming, tokenization, or operator-precedence surprises.

### `FT.PROFILE`

```java
import redis.clients.jedis.search.FTProfileParams;
import redis.clients.jedis.search.ProfilingInfo;

Map.Entry<SearchResult, ProfilingInfo> reply = jedis.ftProfileSearch("idx:bicycle",
    FTProfileParams.profileParams(),
    "@brand:{Velorim}",
    FTSearchParams.searchParams().dialect(2));

SearchResult result = reply.getKey();
Object profile = reply.getValue().getProfilingInfo();   // shape depends on protocol (RESP2/RESP3)
```

For aggregations:

```java
Map.Entry<AggregationResult, ProfilingInfo> aggReply = jedis.ftProfileAggregate("idx:bicycle",
    FTProfileParams.profileParams(),
    new AggregationBuilder("*").groupBy("@brand", Reducers.count().as("n")).dialect(2));
```

The `ProfilingInfo` payload is protocol-shaped: on RESP3 it's a `Map<String, Object>` with `Shards` / `Coordinator` top-level keys (Redis 8+); on RESP2 it's a nested `List`. Cast accordingly — see `SearchWithParamsCommandsTestBase.java` `vectorSearchProfile` for the pattern.

### `FT.INFO`

```java
Map<String, Object> info = jedis.ftInfo("idx:bicycle");
info.get("index_name");                  // "idx:bicycle"
info.get("num_docs");                    // server-stringified counts; cast as needed
info.get("hash_indexing_failures");      // non-zero = silent dropouts (schema mismatch)
info.get("attributes");                  // List of per-field detail maps
info.get("inverted_sz_mb");              // memory footprint
info.get("indexing");                    // 1 while background scan runs
info.get("percent_indexed");             // 0.0 – 1.0
```

`ftInfo` returns a `Map<String, Object>` because the server's reply mixes scalars, lists, and maps. Treat any numeric you read from it as protocol-dependent: RESP2 typically gives strings, RESP3 typed values. Cast defensively.

Key fields to monitor:

| Key | Why it matters |
|-----|----------------|
| `num_docs` | Docs successfully indexed. |
| `hash_indexing_failures` | **Non-zero means silent dropouts** — usually schema/path mismatches. |
| `inverted_sz_mb` | Inverted-index memory footprint. |
| `indexing` | `1` while a background scan is running. |
| `percent_indexed` | Progress of the background scan. |


## 13. Index management

redis-py equivalent: see [`python-redis-py.md#12-index-management`](./python-redis-py.md#12-index-management).

For semantics (FT.ALTER capacity, alias use cases), see [`index-management.md`](../index-management.md).

### Add fields

```java
jedis.ftAlter("idx:bicycle",
    TagField.of("availability"),
    TextField.of("name").weight(0.5));
```

`ftAlter` accepts a varargs of `SchemaField`. Mirrors `SearchWithParamsCommandsTestBase.java` `alter` test. Subject to `MAXTEXTFIELDS` capacity declared at FT.CREATE time. There is no `FT.ALTER` for removing or retyping a field — drop and recreate the index.

### Aliases (for blue/green index swaps)

```java
jedis.ftAliasAdd("idx:bicycle:active", "idx:bicycle_v2");
jedis.ftAliasUpdate("idx:bicycle:active", "idx:bicycle_v2");    // repoint
jedis.ftAliasDel("idx:bicycle:active");
```

Argument order is **`(alias, indexName)`** — Jedis aliases come first, the underlying index second. Mirrors `SearchWithParamsCommandsTestBase.java` `alias` test. Aliases let application code query a stable name while you build a replacement index behind it.

### Drop the index

```java
// Keep documents, drop only the index
jedis.ftDropIndex("idx:bicycle");

// Drop index AND delete every indexed document (destructive)
jedis.ftDropIndexDD("idx:bicycle");
```

`ftDropIndexDD` is the equivalent of `FT.DROPINDEX ... DD` — gone forever, no undo. The double-D in the name signals "drop the docs too."

### List indexes

```java
Set<String> all = jedis.ftList();
```


## 14. Common errors & version gotchas

redis-py equivalent: see [`python-redis-py.md#13-common-errors--version-gotchas`](./python-redis-py.md#13-common-errors--version-gotchas).

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `JedisDataException: unknown command 'FT.CREATE'` (or any other `FT.*`) | Redis < 8.0 without the RediSearch module loaded. | Load the module (`MODULE LOAD /path/to/redisearch.so` or via `loadmodule` in `redis.conf`), or upgrade to Redis ≥ 8.0 where Redis Search is built-in. |
| `JedisDataException: unknown command 'FT.HYBRID'` | Server < 8.4.0. | Upgrade or fall back to pre-filter + KNN via FT.SEARCH (§10). |
| `Syntax error at offset N near KNN` | Missing DIALECT 2. | `FTSearchParams.searchParams().dialect(2)` on every vector query and every modern parser feature. |
| GEOSHAPE WITHIN/CONTAINS returns syntax error | Missing `.dialect(3)`, or server lacks DIALECT 3 support. | Pass `.dialect(3)` explicitly; ensure Redis ≥ 7.2 with GEOSHAPE-capable RediSearch. |
| `JedisDataException: Vector dimension mismatch` | Query vector dim differs from index `DIM`. | Recompute embedding with the same model used at index time; assert `embedding.length == DIM`. |
| Vector query returns 0 hits despite obvious matches | Query vector encoded big-endian or as `double[]`. | Use `RediSearchUtil.toByteArray(float[])` or `ByteBuffer.allocate(n*4).order(LITTLE_ENDIAN).putFloat(...)`. |
| `cannot find symbol: class TextField` | Missing `import redis.clients.jedis.search.schemafields.*;` — `redis.clients.jedis.search.*` does not pull in field types. | Add the `schemafields.*` import explicitly. See §4. |
| `JedisDataException: Index already exists` | `ftCreate` is not "create or replace." | Wrap idempotent setup in try/catch on `JedisDataException`, or `ftDropIndex` first when bootstrapping. |
| JSON paths not matching docs | Document set with `jedis.jsonSet(...)` but index defined `ON HASH` (or vice versa). | Match `IndexDataType` to write path. `ftInfo`'s `hash_indexing_failures > 0` is the signal. |
| `Cannot resolve method 'addTextField'` after upgrade to Jedis 5.x | Code uses deprecated `Schema` class. | Migrate to `SchemaField[]` (see migration below). |
| `Cannot resolve symbol 'Path'` after upgrade | Code uses `redis.clients.jedis.json.Path`. | Switch to `redis.clients.jedis.json.Path2` — current path API for FT.* and JSON commands. |
| Empty `getDocuments()` but non-zero `getTotalResults()` | `.noContent()` was set. | Remove `.noContent()` or call `.returnFields(...)`. |

### `Schema` → `SchemaField[]` migration

Older Jedis code (pre-5.x, or community blog posts) uses the `Schema` class:

```java
// LEGACY — Schema class, do not use in new code.
Schema sc = new Schema()
    .addSortableTextField("name", 1.0)
    .addSortableNumericField("count")
    .addTagField("tags");
jedis.ftCreate(INDEX, IndexOptions.defaultOptions(), sc);
```

Current API:

```java
// MODERN — SchemaField[] + FTCreateParams.
SchemaField[] schema = {
    TextField.of("name").weight(1.0).sortable(),
    NumericField.of("count").sortable(),
    TagField.of("tags")
};
jedis.ftCreate(INDEX, FTCreateParams.createParams(), schema);
```

Translation rules:
- `addTextField(name, weight)` → `TextField.of(name).weight(weight)`
- `addSortableTextField(...)` → `.sortable()` chained
- `addNumericField(name)` → `NumericField.of(name)`
- `addTagField(name)` → `TagField.of(name)`
- `addVectorField(name, algo, attrs)` → `VectorField.builder().fieldName(name).algorithm(algo).attributes(attrs).build()`
- `IndexOptions.defaultOptions()` → `FTCreateParams.createParams()` (then chain `.on(IndexDataType.JSON)`, `.addPrefix(...)`, etc.)

### `Path` vs `Path2`

| Class | Status | Use it |
|-------|--------|--------|
| `redis.clients.jedis.json.Path` | Legacy | No |
| `redis.clients.jedis.json.Path2` | Current | **Yes** — for `jsonSet`, `jsonGet`, `jsonDel`, and any `$.*` paths the FT.* schema references. All upstream examples use `Path2`. |


## 15. Upstream examples index

redis-py equivalent: see [`python-redis-py.md#14-upstream-examples-index`](./python-redis-py.md#14-upstream-examples-index).

Curated index of `STEP_START` labels in `redis/jedis/src/test/java/io/redis/examples/` and the broader Jedis FT.* test suite, so you can fetch the runnable Java source by step name. Step labels match the redis-py reference where the two clients cover the same operation — pair them up to verify cross-language behaviour.

| Step label | Operation | Upstream file |
|------------|-----------|---------------|
| `connect` | `RedisClient.create("localhost", 6379)` | `SearchQuickstartExample.java` |
| `create_index` (bicycle JSON) | JSON schema with TEXT/TAG/NUMERIC + `.as(alias)` | `SearchQuickstartExample.java` |
| `add_documents` | `jsonSetWithEscape(key, bicyclePojo)` | `SearchQuickstartExample.java` |
| `wildcard_query` | `Query("*")` | `SearchQuickstartExample.java` |
| `query_single_term` | `Query("@model:Jigger")` | `SearchQuickstartExample.java` |
| `query_single_term_limit_fields` | `Query("@model:Jigger").returnFields("price")` | `SearchQuickstartExample.java` |
| `query_single_term_and_num_range` | `Query("basic @price:[500 1000]")` | `SearchQuickstartExample.java` |
| `query_exact_matching` | `Query("@brand:\"Noka Bikes\"")` | `SearchQuickstartExample.java` |
| `simple_aggregation` | `AggregationBuilder("*").groupBy(...).count()` | `SearchQuickstartExample.java` |
| `import` | Canonical import block | `HomeJsonExample.java` |
| `make_index` | JSON index for users | `HomeJsonExample.java` |
| `make_hash_index` | HASH index, same fields without `$.` paths | `HomeJsonExample.java` |
| `add_data` | `jedis.jsonSet(key, Path2.ROOT_PATH, doc)` | `HomeJsonExample.java` |
| `query1` | `ftSearch("idx:users", "Paul @age:[30 40]")` | `HomeJsonExample.java` |
| `query2` | `FTSearchParams.searchParams().returnFields("city")` | `HomeJsonExample.java` |
| `query3` | `AggregationBuilder("*").groupBy("@city", Reducers.count().as("count"))` | `HomeJsonExample.java` |
| `em1` | Numeric exact match `@price:[270 270]` + `.filter("price", 270, 270)` | `QueryEmExample.java` |
| `em2` | TAG exact match `@condition:{new}` | `QueryEmExample.java` |
| `em3` | Escaping `@email` via `RediSearchUtil.escapeQuery` | `QueryEmExample.java` |
| `em4` | Exact phrase `@description:"rough terrain"` | `QueryEmExample.java` |
| `ft1`–`ft5` | Field-scoped term, prefix, suffix, fuzzy `%term%`, double-fuzzy `%%term%%` | `QueryFtExample.java` |
| `range1` | Inclusive `@price:[500 1000]` | `QueryRangeExample.java` |
| `range2` | `.filter("price", 500, 1000)` form | `QueryRangeExample.java` |
| `range3` | `.filter("price", 1000, true, +inf, false)` (exclusive lower) | `QueryRangeExample.java` |
| `range4` | Range + `.sortBy(..., ASC).limit(0, 5)` | `QueryRangeExample.java` |
| `geo1` | Geo radius parameterised via `.addParam` | `QueryGeoExample.java` |
| `geo2` | `GEOSHAPE CONTAINS` with `.dialect(3)` | `QueryGeoExample.java` |
| `geo3` | `GEOSHAPE WITHIN` polygon | `QueryGeoExample.java` |
| `agg1` | `LOAD` + `APPLY` (no grouping) | `QueryAggExample.java` |
| `agg2` | `APPLY` + `GROUPBY` + `Reducers.sum` | `QueryAggExample.java` |
| `agg3` | Synthesised group key via `.apply("'bicycle'", "type")` | `QueryAggExample.java` |
| `agg4` | `GROUPBY` + `Reducers.to_list("__key")` | `QueryAggExample.java` |
| `aggregate_cursor_open` (in-doc; pairs with redis-py `aggregate_cursor_open`) | `.cursor(count, maxIdle)` opens the cursor; `getCursorId()` reads it | `AggregationCommandsTestBase.java` (`cursor()` test) |
| `aggregate_cursor_read` (in-doc; pairs with redis-py `aggregate_cursor_read`) | `ftCursorRead(index, cursorId, count)` page loop | `AggregationCommandsTestBase.java` (`cursor()` test) |
| `aggregate_cursor_del` (in-doc; pairs with redis-py `aggregate_cursor_del`) | `ftCursorDel(index, cursorId)` explicit release | `AggregationCommandsTestBase.java` (`cursor()` test) |
| `aggregateIteration` (upstream method name) | `ftAggregateIteration(...)` higher-level loop helper | `AggregationCommandsTestBase.java` |
| `vector_knn` (in-doc; pairs with redis-py `vector_knn`) | `(*)=>[KNN 3 @vector $query_vector AS vector_score]` | `SearchWithParamsCommandsTestBase.java` (`testHNSWVectorSimilarity`) |
| `vector_prefilter` (in-doc; pairs with redis-py `vector_prefilter`) | `(@price:[…] -@condition:{new})=>[KNN 3 @vector $query_vector …]` | `SearchWithParamsCommandsTestBase.java` (`testHNSWVectorSimilarity`) |
| `vector_range` (in-doc; pairs with redis-py `vector_range`) | `@vector:[VECTOR_RANGE $range $query_vector]=>{$YIELD_DISTANCE_AS: …}` | `SearchWithParamsCommandsTestBase.java` |
| `testHNSWVectorSimilarity` | `VectorField.builder().algorithm(HNSW)` + `*=>[KNN 2 @v $vec]` | `SearchWithParamsCommandsTestBase.java` |
| `testFlatVectorSimilarity` | `VectorField.builder().algorithm(FLAT)` + `*=>[KNN 2 @v $vec]` | `SearchWithParamsCommandsTestBase.java` |
| `vectorSearchProfile` | KNN inside `ftProfileSearch` | `SearchWithParamsCommandsTestBase.java` |
| `testComprehensiveFtHybridWithAllFeatures` | Full `ftHybrid` with `linear()` combiner + post-processing pipeline | `FTHybridCommandsTestBase.java` |
| `alter` | `ftAlter(index, TagField.of(...), TextField.of(...).weight(0.5))` | `SearchWithParamsCommandsTestBase.java` |
| `alias` | `ftAliasAdd` / `ftAliasUpdate` / `ftAliasDel` | `SearchWithParamsCommandsTestBase.java` |
| `ftExplain` | `ftExplain(index, new Query(...).dialect(2))` | `SearchWithParamsCommandsTestBase.java` |
| `info` | `ftInfo(index)` returns `Map<String, Object>` | `SearchWithParamsCommandsTestBase.java` |

Examples files live under `https://github.com/redis/jedis/tree/master/src/test/java/io/redis/examples/`. The FT.* test bases (`SearchWithParamsCommandsTestBase`, `AggregationCommandsTestBase`, `FTHybridCommandsTestBase`) live under `https://github.com/redis/jedis/tree/master/src/test/java/redis/clients/jedis/commands/unified/search/`.
