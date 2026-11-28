
# redis-py — Redis Search quick reference

This reference covers the `FT.*` (Redis Search) surface of the raw `redis-py` client. It shows how `redis-py` *expresses* the canonical CLI form — it does not re-explain the query DSL. Read it after a reference that already states *what* to do.

- **Query DSL vocabulary** (delimiters, operators, attributes): [`../search-syntax-primitives.md`](../search-syntax-primitives.md). Do not duplicate that grammar here.
- **Jedis (Java) equivalents** for the same operations: [`java-jedis.md`](./java-jedis.md).
- **RedisVL** is a different SDK (schema-first, semantic-cache, message-history). For RedisVL targets, read [`python-redisvl.md`](./python-redisvl.md) instead; the two are not interchangeable.

Examples below trace to specific files in `redis/redis-py/doctests/` and preserve the upstream `STEP_START`/`STEP_END` labels so you can pair-verify against the runnable source. The shared **Bicycle dataset** (`bicycle:<n>` JSON docs with `brand`, `model`, `description`, `price`, `condition`, `type`, `store_location`, `description_embeddings`) is used throughout.

## Table of contents

1. [Minimum supported versions](#1-minimum-supported-versions)
2. [Connection setup](#2-connection-setup)
3. [Schema imports](#3-schema-imports)
4. [Create index — HASH](#4-create-index--hash)
5. [Create index — JSON](#5-create-index--json)
6. [FT.SEARCH idioms](#6-ftsearch-idioms)
7. [FT.AGGREGATE idioms](#7-ftaggregate-idioms)
8. [Cursors](#8-cursors)
9. [Vector queries](#9-vector-queries)
10. [FT.HYBRID](#10-fthybrid)
11. [Debugging](#11-debugging)
12. [Index management](#12-index-management)
13. [Common errors & version gotchas](#13-common-errors--version-gotchas)
14. [Upstream examples index](#14-upstream-examples-index)


## 1. Minimum supported versions

Jedis equivalent: see [`java-jedis.md#1-minimum-supported-versions`](./java-jedis.md#1-minimum-supported-versions).

| Component | Minimum | Notes |
|-----------|---------|-------|
| `redis-py` | **5.0** | Earlier 4.x releases predate the consolidated `redis.commands.search.*` import paths and lack `IndexType.JSON` ergonomics. |
| `redis-py` (for `HybridQuery`) | **7.1.0** | The `redis.commands.search.hybrid_query` module ships from `redis-py` 7.1.0. Older releases (5.x–7.0.x) lack the `HybridQuery` builder and `index.hybrid_search()`. |
| Redis server (FT.SEARCH / FT.AGGREGATE) | **7.4** | Redis Search ships built-in from Redis 8.0; 7.4 still requires the RediSearch module. |
| Redis server (`FT.HYBRID`) | **8.4.0** | Hard floor. Older Redis returns `unknown command 'FT.HYBRID'`. Fall back to pre-filter + `=>[KNN ...]` via FT.SEARCH. |
| Python | 3.8+ | Type hints in `redis.commands.search.*` assume `typing` from 3.8. |

**DIALECT default:** `redis-py` does **not** set DIALECT on your behalf. Every query in this reference passes `DIALECT 2` explicitly (`.dialect(2)` or as a `Query()` argument) — required for vector attribute syntax (`=>[KNN ...]`) and the modern numeric/tag parser. Redis 8 changed the server default to DIALECT 2, but client-side absence still emits the server's compatibility default for older servers.


## 2. Connection setup

Jedis equivalent: see [`java-jedis.md#2-connection-setup`](./java-jedis.md#2-connection-setup).

The canonical connect, from `doctests/search_quickstart.py` — STEP_START `connect`:

```python
import redis

r = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
```

`decode_responses=True` is the right default for `FT.*` work because Search returns field names and string values as bytes by default — every result tuple becomes `b"..."` keys/values otherwise. The case that justifies leaving it `False`:

- **Vector blobs you re-emit unchanged.** Vector data is binary `FLOAT32` bytes; with `decode_responses=True` Redis Search still returns them correctly because the client only decodes RESP simple/bulk strings, but mixing decoded + raw bytes in the same result set is error-prone.

For FT.HYBRID results, field decoding differs — see §10.

Pool reuse (for any non-toy app):

```python
pool = redis.ConnectionPool(host="localhost", port=6379, decode_responses=True, max_connections=32)
r = redis.Redis(connection_pool=pool)
```

Reuse one `Redis()` instance across threads — it's thread-safe via the underlying pool.


## 3. Schema imports

Jedis equivalent: see [`java-jedis.md#3-schema-imports`](./java-jedis.md#3-schema-imports).

`redis-py` splits the Search API across submodules of `redis.commands.search`. The canonical import block, mirroring `doctests/search_quickstart.py` and `search_vss.py`:

```python
from redis.commands.search.field import (
    TextField,
    TagField,
    NumericField,
    GeoField,
    GeoShapeField,
    VectorField,
)
from redis.commands.search.index_definition import IndexDefinition, IndexType
from redis.commands.search.query import Query, NumericFilter
from redis.commands.search.aggregation import AggregateRequest, Cursor
import redis.commands.search.reducers as reducers
```

Notes:

- `index_definition` is the modern path; older code imports from `indexDefinition` (camelCase). Both work in 5.x, but the underscore form is what current upstream doctests use.
- The two query builders are **different classes**: `Query` for `FT.SEARCH`, `AggregateRequest` for `FT.AGGREGATE`. They are not interchangeable and don't share methods. This is the single most common source of confusion when porting from another client.
- `redis.commands.search.reducers` is a *module* of factory functions (`count()`, `sum()`, `avg()`, `tolist()`), not a class — that's why upstream imports it with `as reducers`.


## 4. Create index — HASH

Jedis equivalent: see [`java-jedis.md#4-create-index--hash`](./java-jedis.md#4-create-index--hash).

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

redis-py — mirrors `doctests/home_json.py` STEP_START `make_hash_index` (the upstream HASH index example; `home_json.py` itself is JSON-indexed elsewhere, but this specific step demonstrates the HASH variant):

```python
# STEP_START create_index_hash
schema = (
    TextField("model", weight=2.0),
    TextField("description"),
    TagField("brand"),
    TagField("condition"),
    NumericField("price", sortable=True),
    GeoField("store_location"),
)
r.ft("idx:bicycle").create_index(
    schema,
    definition=IndexDefinition(prefix=["bicycle:"], index_type=IndexType.HASH),
)
# STEP_END
```

HASH-specific notes:

- Field names in the schema are the **hash field names verbatim** (no `$.` path prefix; no `as_name`).
- Document keys must literally start with the declared prefix — `bicycle:1`, `bicycle:2`, … An empty / missing prefix indexes every hash in the database.
- Use `r.hset("bicycle:1", mapping={...})` to add documents; indexing happens synchronously on write.


## 5. Create index — JSON

Jedis equivalent: see [`java-jedis.md#5-create-index--json`](./java-jedis.md#5-create-index--json).

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

redis-py — mirrors `doctests/search_quickstart.py` STEP_START `create_index` and `home_json.py` STEP_START `make_index`:

```python
# STEP_START create_index_json
schema = (
    TextField("$.brand", as_name="brand"),
    TextField("$.model", as_name="model"),
    TextField("$.description", as_name="description"),
    NumericField("$.price", as_name="price"),
    TagField("$.condition", as_name="condition"),
)
r.ft("idx:bicycle").create_index(
    schema,
    definition=IndexDefinition(prefix=["bicycle:"], index_type=IndexType.JSON),
)
# STEP_END
```

JSON-specific notes:

- The first positional argument is the **JSONPath**, not the alias. Always pair it with `as_name="<alias>"`; the alias is what queries reference as `@<alias>`.
- Without `as_name`, Redis auto-generates a field alias from the path — usable but brittle (renaming the JSON key silently breaks the index).
- Array projections use `[*]`: `TextField("$.tags[*]", as_name="tags")`. Nested objects use the obvious `$.address.city`.
- Add documents with `r.json().set("bicycle:1", "$", {...})` (see `home_json.py` STEP_START `add_data`).


## 6. FT.SEARCH idioms

Jedis equivalent: see [`java-jedis.md#6-ftsearch-idioms`](./java-jedis.md#6-ftsearch-idioms).

For the query DSL itself (delimiters, operators, escaping), read [`../search-syntax-primitives.md`](../search-syntax-primitives.md). This section shows only how `redis-py` *binds* a query to `FT.SEARCH`.

### The `Query` builder

`Query("<expression>")` wraps the query expression. The fluent setters mirror `FT.SEARCH` flags:

| `Query` method | CLI equivalent | Purpose |
|----------------|----------------|---------|
| `.paging(offset, num)` | `LIMIT offset num` | Result page slice. |
| `.sort_by(field, asc=True)` | `SORTBY field ASC|DESC` | Override score-based ranking. Requires `SORTABLE` at index time. |
| `.return_fields(*fields)` | `RETURN n f1 f2 ...` | Project only listed fields. |
| `.return_field(path, as_field=...)` | `RETURN n path AS alias` | JSON projection by path with alias. |
| `.no_content()` | `NOCONTENT` | IDs only — saves bandwidth for `LIMIT 0 0` count queries. |
| `.with_scores()` | `WITHSCORES` | Append relevance score per hit. |
| `.verbatim()` | `VERBATIM` | Disable stemming. |
| `.dialect(2)` | `DIALECT 2` | **Always pass this.** |
| `.add_filter(NumericFilter(...))` | `FILTER field min max` | Inline numeric range; alternative to `@field:[min max]` in the expression. |

### Exact match (TAG / NUMERIC) — mirrors `doctests/query_em.py`

```python
# STEP_START em1 — numeric exact match via range with equal bounds
r.ft("idx:bicycle").search(Query("@price:[270 270]").dialect(2))

# STEP_START em2 — tag exact match
r.ft("idx:bicycle").search(Query("@condition:{new}").dialect(2))

# STEP_START em4 — exact phrase in TEXT
r.ft("idx:bicycle").search(Query('@description:"rough terrain"').dialect(2))
```

### Numeric ranges — mirrors `doctests/query_range.py`

```python
# STEP_START range1 — inclusive
r.ft("idx:bicycle").search(Query("@price:[500 1000]").dialect(2))

# STEP_START range3 — exclusive lower, unbounded upper, via NumericFilter
q = Query("*").add_filter(NumericFilter("price", "(1000", "+inf")).dialect(2)
r.ft("idx:bicycle").search(q)

# STEP_START range4 — sorted + paged
q = Query("@price:[-inf 2000]").sort_by("price").paging(0, 5).dialect(2)
r.ft("idx:bicycle").search(q)
```

`NumericFilter` accepts numeric values or RESP-style strings (`"(1000"` for exclusive, `"+inf"` / `"-inf"`).

### Full-text idioms — mirrors `doctests/query_ft.py`

```python
# STEP_START ft1 — field-scoped term
r.ft("idx:bicycle").search(Query("@description: kids").dialect(2))

# STEP_START ft2 — prefix
r.ft("idx:bicycle").search(Query("@model: ka*").dialect(2))

# STEP_START ft3 — suffix (requires WITHSUFFIXTRIE at index time for efficiency)
r.ft("idx:bicycle").search(Query("@brand: *bikes").dialect(2))

# STEP_START ft4 — fuzzy (Levenshtein distance 1)
r.ft("idx:bicycle").search(Query("%optamized%").dialect(2))
```

### Geo — mirrors `doctests/query_geo.py`

```python
# STEP_START geo1 — radius query, parametrised
params = {"lon": -0.1778, "lat": 51.5524, "radius": 20, "units": "mi"}
q = Query("@store_location:[$lon $lat $radius $units]").dialect(2)
r.ft("idx:bicycle").search(q, query_params=params)

# STEP_START geo2 — GEOSHAPE CONTAINS (requires DIALECT 3)
# DIALECT 3 required for GEOSHAPE WITHIN/CONTAINS predicates (Redis 7.2+ with FT.CREATE GEOSHAPE field).
params = {"bike": "POINT(-0.1278 51.5074)"}
q = Query("@pickup_zone:[CONTAINS $bike]").dialect(3)
r.ft("idx:bicycle").search(q, query_params=params)
```

`query_params` is the redis-py mechanism for binding `$name` placeholders in the query expression — use it for any user-supplied or binary value (vector blobs, geo points, range bounds).

### Reading results

`search()` returns a `Result` with `.total` (server-reported match count) and `.docs` (list of `Document` objects). Each `Document` exposes `id`, `payload`, and one attribute per returned field:

```python
res = r.ft("idx:bicycle").search(Query("@condition:{new}").return_fields("brand", "model", "price").dialect(2))
for doc in res.docs:
    print(doc.id, doc.brand, doc.model, doc.price)
```

When `decode_responses=False`, both attribute names and values come back as bytes — fix it at the connection level, not via per-result decoding.


## 7. FT.AGGREGATE idioms

Jedis equivalent: see [`java-jedis.md#7-ftaggregate-idioms`](./java-jedis.md#7-ftaggregate-idioms).

For pipeline-stage ordering rules, see [`aggregate-pipeline.md`](../aggregate-pipeline.md). This section shows only the `redis-py` builder shape.

### The `AggregateRequest` builder

`AggregateRequest("<filter-expression>")` is a separate class from `Query`. The fluent setters map directly to `FT.AGGREGATE` stages:

| `AggregateRequest` method | CLI stage |
|---------------------------|-----------|
| `.load(*fields)` | `LOAD n f1 f2 ...` |
| `.apply(alias="<expr>")` | `APPLY <expr> AS alias` (keyword form: alias on left) |
| `.filter("<expr>")` | `FILTER <expr>` |
| `.group_by(field_or_list, *reducers)` | `GROUPBY n f1 ... REDUCE ...` |
| `.sort_by(("<field>", "ASC|DESC"))` | `SORTBY n <field> ASC|DESC` |
| `.limit(offset, num)` | `LIMIT offset num` |
| `.cursor(count=<n>, max_idle=<seconds>)` | `WITHCURSOR [COUNT n] [MAXIDLE ms]` (see §8) |
| `.dialect(2)` | `DIALECT 2` |

Reducers live in `redis.commands.search.reducers` as factory functions. Common ones:

| Factory | CLI form |
|---------|----------|
| `reducers.count()` | `REDUCE COUNT 0` |
| `reducers.count_distinct("@f")` | `REDUCE COUNT_DISTINCT 1 @f` |
| `reducers.sum("@f")` | `REDUCE SUM 1 @f` |
| `reducers.avg("@f")` | `REDUCE AVG 1 @f` |
| `reducers.min("@f")` / `reducers.max("@f")` | `REDUCE MIN 1 @f` / `MAX 1 @f` |
| `reducers.quantile("@f", 0.95)` | `REDUCE QUANTILE 2 @f 0.95` |
| `reducers.tolist("@f")` | `REDUCE TOLIST 1 @f` |

Every reducer factory takes `.alias("<name>")` to set the `AS <alias>` token.

### Worked pipeline — mirrors `doctests/query_agg.py`

```python
# STEP_START agg1 — LOAD + APPLY (no grouping)
req = (
    AggregateRequest(query="@condition:{new}")
    .load("__key", "price")
    .apply(discounted="@price - (@price * 0.1)")
    .dialect(2)
)
res = r.ft("idx:bicycle").aggregate(req)
# res.rows -> [['__key', 'bicycle:0', 'price', '270', 'discounted', '243'], ...]

# STEP_START agg2 — APPLY + GROUPBY + REDUCE
req = (
    AggregateRequest(query="*")
    .load("price")
    .apply(price_category="@price<1000")
    .group_by("@condition", reducers.sum("@price_category").alias("num_affordable"))
    .dialect(2)
)
r.ft("idx:bicycle").aggregate(req)

# STEP_START agg3 — synthesised group key via APPLY (mirrors doctests/query_agg.py)
req = (
    AggregateRequest(query="*")
    .apply(type="'bicycle'")
    .group_by("@type", reducers.count().alias("num_total"))
    .dialect(2)
)
r.ft("idx:bicycle").aggregate(req)
# res.rows -> [['type', 'bicycle', 'num_total', '10']]

# STEP_START agg4 — GROUPBY + TOLIST
req = (
    AggregateRequest(query="*")
    .load("__key")
    .group_by("@condition", reducers.tolist("__key").alias("bicycles"))
    .dialect(2)
)
r.ft("idx:bicycle").aggregate(req)
```

Result shape: `AggregateResult` with `.rows` (a list of flat `[key, val, key, val, ...]` lists, mirroring RESP2). Pair adjacent elements yourself or convert via the upstream `pandas` helper in `search_vss.py`.

`.apply()` uses keyword arguments where the **keyword is the alias** and the value is the expression — `apply(discounted="@price * 0.9")` emits `APPLY "@price * 0.9" AS discounted`.


## 8. Cursors

Jedis equivalent: see [`java-jedis.md#8-cursors`](./java-jedis.md#8-cursors).

For lifecycle rules and when to use cursors, see [`aggregate-cursors.md`](../aggregate-cursors.md).

> **API note.** `redis-py` 5.x does not expose standalone `ft().cursor_read()` or `ft().cursor_del()` methods. `FT.CURSOR READ` is invoked by passing a `Cursor` instance back to `ft().aggregate(cursor)`. `FT.CURSOR DEL` requires the raw `r.execute_command("FT.CURSOR", "DEL", index, cursor_id)` path shown below.

CLI form:

```
FT.AGGREGATE idx:bicycle "*"
    GROUPBY 1 @brand REDUCE COUNT 0 AS n
    WITHCURSOR COUNT 1000 MAXIDLE 30000
    DIALECT 2

FT.CURSOR READ idx:bicycle <cursor_id> COUNT 1000
FT.CURSOR DEL  idx:bicycle <cursor_id>
```

redis-py — open a cursor:

```python
# STEP_START aggregate_cursor_open
req = (
    AggregateRequest(query="*")
    .group_by("@brand", reducers.count().alias("n"))
    .cursor(count=1000, max_idle=30.0)   # max_idle is seconds; client converts to ms
    .dialect(2)
)
result = r.ft("idx:bicycle").aggregate(req)
cursor = result.cursor             # redis.commands.search.aggregation.Cursor
first_batch = result.rows
# STEP_END
```

Read the next page by passing the `Cursor` back into `aggregate()`:

```python
# STEP_START aggregate_cursor_read
while cursor.cid != 0:             # cid == 0 signals exhausted server-side cursor
    cursor.count = 1000            # optional: override per-read batch size
    page = r.ft("idx:bicycle").aggregate(cursor)
    cursor = page.cursor
    process(page.rows)
# STEP_END
```

Explicit cleanup (release before MAXIDLE):

```python
# STEP_START aggregate_cursor_del
r.execute_command("FT.CURSOR", "DEL", "idx:bicycle", cursor.cid)
# STEP_END
```

See the API note at the top of this section — `FT.CURSOR DEL` requires `execute_command`; `FT.CURSOR READ` is wrapped via `aggregate(cursor)`.


## 9. Vector queries

Jedis equivalent: see [`java-jedis.md#9-vector-queries`](./java-jedis.md#9-vector-queries).

For query-attribute syntax (`=>[KNN ...]`, `[VECTOR_RANGE ...]`) and pre-filter shape, read [`vector-query.md`](../vector-query.md).

### Index a vector field

CLI form:

```
FT.CREATE idx:bicycle ON JSON PREFIX 1 bicycle: SCHEMA
    ...
    $.description_embeddings AS vector VECTOR FLAT 6
        TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE
```

redis-py — mirrors `doctests/search_vss.py` STEP_START `create_index` (dimension parametrised; use 1536 for OpenAI `text-embedding-3-small` / `ada-002`):

```python
# STEP_START create_vector_index
VECTOR_DIMENSION = 1536            # match your embedding model
schema = (
    TextField("$.model", no_stem=True, as_name="model"),
    TextField("$.brand", no_stem=True, as_name="brand"),
    NumericField("$.price", as_name="price"),
    TagField("$.type", as_name="type"),
    VectorField(
        "$.description_embeddings",
        "FLAT",                    # or "HNSW" for ANN
        {
            "TYPE": "FLOAT32",
            "DIM": VECTOR_DIMENSION,
            "DISTANCE_METRIC": "COSINE",
        },
        as_name="vector",
    ),
)
r.ft("idx:bicycle").create_index(
    schema,
    definition=IndexDefinition(prefix=["bicycle:"], index_type=IndexType.JSON),
)
# STEP_END
```

### Encode the query vector

The de facto pattern (used by every upstream doctest): `numpy.array(...).astype(np.float32).tobytes()`. Mirrors `query_combined.py`:

```python
import numpy as np

def embed_to_bytes(model, text: str) -> bytes:
    return np.array(model.encode(text)).astype(np.float32).tobytes()
```

`FLOAT32` little-endian is the only encoding `redis-py` ships with — match this on both index and query side, every time. A `FLOAT64` array silently produces zero hits because the per-element byte offsets disagree with the index's `TYPE FLOAT32`.

### KNN — mirrors `doctests/search_vss.py` STEP_START `run_knn_query`

```python
# STEP_START vector_knn
query = (
    Query("(*)=>[KNN 3 @vector $query_vector AS vector_score]")
    .sort_by("vector_score")
    .return_fields("vector_score", "id", "brand", "model", "description")
    .dialect(2)
)
res = r.ft("idx:bicycle").search(
    query,
    query_params={"query_vector": embed_to_bytes(model, "Bike for small kids")},
)
# STEP_END
```

### Pre-filtered KNN — mirrors `doctests/query_combined.py` STEP_START `combined7`

```python
# STEP_START vector_prefilter
query = (
    Query("(@price:[500 1000] -@condition:{new})=>[KNN 3 @vector $query_vector AS vector_score]")
    .sort_by("vector_score")
    .return_fields("vector_score", "brand", "model", "price")
    .dialect(2)
)
r.ft("idx:bicycle").search(query, query_params={"query_vector": query_vec})
# STEP_END
```

The pre-filter `(@price:[500 1000] -@condition:{new})` is applied **before** the KNN scan — it shrinks the candidate set HNSW/FLAT has to walk. Forgetting it is the most common cause of slow vector queries.

### Range — mirrors `doctests/search_vss.py` STEP_START `run_range_query`

```python
# STEP_START vector_range
range_query = (
    Query(
        "@vector:[VECTOR_RANGE $range $query_vector]=>"
        "{$YIELD_DISTANCE_AS: vector_score}"
    )
    .sort_by("vector_score")
    .return_fields("vector_score", "brand", "model", "description")
    .paging(0, 4)
    .dialect(2)
)
r.ft("idx:bicycle").search(
    range_query,
    query_params={"range": 0.55, "query_vector": query_vec},
)
# STEP_END
```

`AS <alias>` (KNN form) and `$YIELD_DISTANCE_AS` (RANGE form) are not interchangeable — the upstream doctest demonstrates the difference.

### HNSW tuning per-query

`EF_RUNTIME` is an in-query attribute:

```python
Query("*=>[KNN 10 @vector $query_vector EF_RUNTIME 200 AS score]").dialect(2)
```

Index-time `EF_CONSTRUCTION` is set in the `VectorField` algorithm dict and is independent.


## 10. FT.HYBRID

Jedis equivalent: see [`java-jedis.md#10-fthybrid`](./java-jedis.md#10-fthybrid).

**Version gate:** `FT.HYBRID` requires Redis ≥ **8.4.0** *and* `redis-py` ≥ **7.1.0** (the release that ships the `hybrid_query` module). On older Redis or older `redis-py`, use the pre-filter + KNN pattern in §9. See [`command-selection.md`](../command-selection.md) for the SEARCH vs AGGREGATE vs HYBRID decision.

### High-level builder (recommended)

`redis-py` ≥ **7.1.0** ships an `@experimental` high-level `HybridQuery` builder under `redis.commands.search.hybrid_query`. The shape: build a `HybridSearchQuery` (text leg) + `HybridVsimQuery` (vector leg), combine with a `CombineResultsMethod`, call `index.hybrid_search(...)`.

```python
# STEP_START hybrid_query
from redis.commands.search.hybrid_query import (
    HybridQuery,
    HybridSearchQuery,
    HybridVsimQuery,
    VectorSearchMethods,
    CombineResultsMethod,
    CombinationMethods,
    HybridPostProcessingConfig,
)
# Result types live in a separate module:
from redis.commands.search.hybrid_result import HybridResult, HybridCursorResult

search_leg = HybridSearchQuery(
    query_string="laptop",
    scorer="BM25",
    yield_score_as="text_score",
)
vsim_leg = HybridVsimQuery(
    vector_field_name="@description_vector",
    vector_data="$query_vec",                    # bound via params_substitution below
    vsim_search_method=VectorSearchMethods.KNN,
    vsim_search_method_params={"K": 10, "EF_RUNTIME": 100},
    yield_score_as="vec_score",
)
hybrid = HybridQuery(search_leg, vsim_leg)
combine = CombineResultsMethod(
    CombinationMethods.RRF,                      # or CombinationMethods.LINEAR
    WINDOW=100,
    YIELD_SCORE_AS="final_score",
)
result = r.ft("idx:bicycle").hybrid_search(
    hybrid,
    combine_method=combine,
    params_substitution={"query_vec": embed_to_bytes(model, "laptop")},
    timeout=2000,
)
# STEP_END
```

Returns a `HybridResult` (or `HybridCursorResult` when `cursor=...` is supplied).

### Important behaviours

- `hybrid_search` is decorated `@experimental_method()`. API may shift; pin `redis-py` if you depend on it in production.
- `LOAD`-returned field values come back as **bytes by default**, even with `decode_responses=True`, to match the legacy RESP2 HYBRID contract. Opt into decoding per field via `HybridPostProcessingConfig.load("brand", "model", decode_field=True)` and pass the config as `post_processing=`.
- `CombineResultsMethod` kwargs are **passed verbatim** to the server — `WINDOW`, `CONSTANT`, `YIELD_SCORE_AS` for RRF; `ALPHA`, `BETA`, `YIELD_SCORE_AS` for LINEAR. The client does no validation.

### Raw `execute_command` fallback

When you need a feature not yet wrapped (or are on a redis-py minor that pre-dates the high-level builder), drop to raw RESP:

```python
r.execute_command(
    "FT.HYBRID", "idx:bicycle",
    "SEARCH", "laptop",
    "VSIM", "@description_vector", "$query_vec",
    "KNN", "2", "K", "10",
    "COMBINE", "RRF", "2", "WINDOW", "100",
    "PARAMS", "2", "query_vec", embed_to_bytes(model, "laptop"),
    "DIALECT", "2",
)
```

The raw shape mirrors the verified syntax in spec 0001 §5.0a.

Upstream: `redis/redis-py` master — `redis/commands/search/hybrid_query.py` (builder classes), `redis/commands/search/hybrid_result.py` (`HybridResult`, `HybridCursorResult`), and `redis/commands/search/commands.py` (the `hybrid_search` method). The API is decorated `@experimental_method` and may shift between minor releases — pin `redis-py` if you depend on it.


## 11. Debugging

Jedis equivalent: see [`java-jedis.md#11-debugging`](./java-jedis.md#11-debugging).

For interpreting `FT.EXPLAIN` and `FT.PROFILE` output, see [`debugging.md`](../debugging.md).

### `FT.EXPLAIN`

```python
# Pass either a Query or a raw string
plan = r.ft("idx:bicycle").explain(
    Query("(@brand:{Velorim}) @price:[100 500]").dialect(2)
)
print(plan)
# INTERSECT {
#   TAG:@brand {
#     Velorim
#   }
#   NUMERIC {100.000000 <= @price <= 500.000000}
# }
```

The output is a parse tree — useful for spotting unexpected stemming, tokenization, or operator-precedence surprises.

### `FT.PROFILE`

```python
result, profile_info = r.ft("idx:bicycle").profile(
    Query("@brand:{Velorim}").dialect(2),
    limited=False,
)
print(profile_info.iterators_profile)
print(profile_info.result_processors_profile)
print(profile_info.total_profile_time)
```

`profile()` returns a `(Result, ProfileInformation)` tuple for `Query` input; for `AggregateRequest` it returns `(AggregateResult, ProfileInformation)`. `limited=True` suppresses the per-iterator detail when you only care about totals.

### `FT.INFO`

```python
info = r.ft("idx:bicycle").info()
print(info["num_docs"], info["hash_indexing_failures"], info["inverted_sz_mb"])
```

`info` is a dict-like with stringly-typed values (Redis returns them as strings; cast to int/float as needed). Key fields to monitor:

| Key | Why it matters |
|-----|----------------|
| `num_docs` | Docs successfully indexed. |
| `hash_indexing_failures` | **Non-zero means silent dropouts** — usually schema/path mismatches. |
| `inverted_sz_mb` | Inverted-index memory footprint. |
| `indexing` | `1` while a background scan is running. |
| `percent_indexed` | Progress of the background scan. |


## 12. Index management

Jedis equivalent: see [`java-jedis.md#12-index-management`](./java-jedis.md#12-index-management).

For semantics (FT.ALTER capacity, alias use cases), see [`index-management.md`](../index-management.md).

### Add a field

```python
r.ft("idx:bicycle").alter_schema_add(TagField("availability"))
```

Subject to the `MAXTEXTFIELDS` capacity declared at FT.CREATE time. There is no `FT.ALTER` for removing or retyping a field — drop and recreate the index.

### Aliases (for blue/green index swaps)

```python
r.ft("idx:bicycle_v2").aliasadd("idx:bicycle:active")
r.ft("idx:bicycle_v2").aliasupdate("idx:bicycle:active")   # repoint existing alias
r.ft("idx:bicycle_v2").aliasdel("idx:bicycle:active")
```

All three are wrapped — they call `FT.ALIASADD` / `FT.ALIASUPDATE` / `FT.ALIASDEL` respectively. Aliases let application code query a stable name while you build a replacement index behind it.

### Drop the index

```python
# Keep documents, drop only the index
r.ft("idx:bicycle").dropindex()

# Drop index AND delete every indexed document (destructive)
r.ft("idx:bicycle").dropindex(delete_documents=True)
```

`delete_documents=True` is the equivalent of `FT.DROPINDEX ... DD` — gone forever, no undo.


## 13. Common errors & version gotchas

Jedis equivalent: see [`java-jedis.md#13-common-errors--version-gotchas`](./java-jedis.md#13-common-errors--version-gotchas).

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `unknown command 'FT.CREATE'` (or any other `FT.*`) | Redis < 8.0 without the RediSearch module loaded. | Load the module (`MODULE LOAD /path/to/redisearch.so` or via `loadmodule` in `redis.conf`), or upgrade to Redis ≥ 8.0 where Redis Search is built-in. |
| `unknown command 'FT.HYBRID'` | Server < 8.4.0. | Upgrade or fall back to pre-filter + KNN via FT.SEARCH (§9). |
| `ImportError` / `cannot import name 'HybridQuery'` from `redis.commands.search.hybrid_query` | `redis-py` < 7.1.0 — the `hybrid_query` module ships from 7.1.0. | Upgrade `redis-py` to ≥ 7.1.0, or fall back to pre-filter + KNN via FT.SEARCH (§9). |
| `Syntax error at offset N near KNN` | Missing `DIALECT 2`. | Always `.dialect(2)` on every `Query` and `AggregateRequest`. |
| `GEOSHAPE WITHIN/CONTAINS` returns syntax error | Missing `.dialect(3)`, or server lacks DIALECT 3 support. | Pass `.dialect(3)` explicitly; ensure Redis ≥ 7.2 with GEOSHAPE-capable RediSearch. |
| `Vector dimension mismatch` | Query vector dim differs from index `DIM`. | Recompute embedding with the same model used at index time; assert `len(arr) == DIM`. |
| Vector query returns 0 hits despite obvious matches | Query vector encoded as `FLOAT64` (default numpy dtype). | Always `.astype(np.float32)` before `.tobytes()`. |
| Result fields come back as `b"..."` bytes | `decode_responses=False`. | Set `decode_responses=True` on the connection. Don't decode per-result. |
| Result fields come back as bytes inside an FT.HYBRID response | Expected: `HybridResult` LOAD values stay bytes by default. | Pass `HybridPostProcessingConfig().load("brand", decode_field=True)` as `post_processing=`. |
| `Index already exists` from idempotent setup | `create_index` is not "create or replace". | Try/except `ResponseError`, or `dropindex()` first when bootstrapping. |
| `JSON paths` not matching docs | Document set with `JSON.SET` but index defined `ON HASH` (or vice versa). | Match `IndexType` to write path; `info()`'s `hash_indexing_failures` > 0 is the signal. |
| Empty `.docs` but non-zero `.total` | `NOCONTENT` (via `.no_content()`) was set. | Remove `.no_content()` or call `.return_fields(...)`. |
| `'@price:[270]' syntax not yet supported` | Single-value numeric-bracket form is a Redis 8 server feature, but `Query` builder validation may reject it pre-Redis-8 clients. | Use `@price:[270 270]` or `NumericFilter("price", 270, 270)` (mirrors `query_em.py`). |

**DIALECT defaults:** server default is DIALECT 2 from Redis 8; older servers default to 1 and reject the vector attribute form (`=>[KNN ...]`). `redis-py` itself never injects DIALECT — *you* must pass `.dialect(2)`. This is the most common silent failure mode when porting code between Redis versions.


## 14. Upstream examples index

Jedis equivalent: see [`java-jedis.md#14-upstream-examples-index`](./java-jedis.md#14-upstream-examples-index).

Curated index of `STEP_START` labels in `redis/redis-py/doctests/` so you can fetch the runnable source by step name. Files live at `https://github.com/redis/redis-py/blob/master/doctests/<file>`.

| Step label | Operation | Upstream file |
|------------|-----------|---------------|
| `connect` | `redis.Redis(host=..., decode_responses=True)` | `search_quickstart.py` |
| `data_sample` | Bicycle JSON document shape | `search_quickstart.py` |
| `create_index` (bicycle JSON) | JSON schema with TEXT/TAG/NUMERIC + `as_name` aliases | `search_quickstart.py` |
| `make_index` | JSON index for users (TextField/TagField/NumericField) | `home_json.py` |
| `make_hash_index` | HASH index, same fields without `$.` paths | `home_json.py` |
| `add_data` | `r.json().set(key, "$", doc)` | `home_json.py` |
| `query1` | `Query("Paul @age:[30 40]")` — combined TEXT + NUMERIC | `home_json.py` |
| `query2` | `Query("Paul").return_field("$.city", as_field="city")` | `home_json.py` |
| `query3` | `AggregateRequest.group_by("@city", reducers.count().alias("count"))` | `home_json.py` |
| `em1` | Numeric exact match `@price:[270 270]` + `NumericFilter` | `query_em.py` |
| `em2` | TAG exact match `@condition:{new}` | `query_em.py` |
| `em4` | Exact phrase in TEXT | `query_em.py` |
| `range1` | Inclusive numeric range | `query_range.py` |
| `range3` | Exclusive lower bound via `NumericFilter("price", "(1000", "+inf")` | `query_range.py` |
| `range4` | Range + `sort_by("price").paging(0, 5)` | `query_range.py` |
| `ft1`–`ft5` | Field-scoped term, prefix, suffix, fuzzy `%term%`, double-fuzzy `%%term%%` | `query_ft.py` |
| `geo1` | Geo radius with `query_params` substitution | `query_geo.py` |
| `geo2` | `GEOSHAPE` CONTAINS, requires `.dialect(3)` | `query_geo.py` |
| `geo3` | `GEOSHAPE` WITHIN polygon | `query_geo.py` |
| `combined1`–`combined7` | Mixed TAG / NUMERIC / TEXT / negation / KNN pre-filter | `query_combined.py` |
| `agg1` | `LOAD` + `APPLY` (no grouping) | `query_agg.py` |
| `agg2` | `APPLY` + `GROUPBY` + `REDUCE SUM` | `query_agg.py` |
| `agg3` | Synthesised group key via `APPLY type="'bicycle'"` | `query_agg.py` |
| `agg4` | `GROUPBY` + `REDUCE TOLIST` | `query_agg.py` |
| `imports` | Canonical `from redis.commands.search.*` import block | `search_vss.py` |
| `create_index` (vector) | JSON schema with `VectorField("FLAT", {...}, as_name="vector")` for VSS | `search_vss.py` |
| `run_knn_query` | `Query("(*)=>[KNN 3 @vector $query_vector AS vector_score]")` | `search_vss.py` |
| `run_hybrid_query` | Pre-filter + KNN: `(@brand:Peaknetic)=>[KNN ...]` | `search_vss.py` |
| `run_range_query` | `[VECTOR_RANGE $range $query_vector]=>{$YIELD_DISTANCE_AS: ...}` | `search_vss.py` |


### Footer: async

`redis.asyncio.Redis` mirrors the sync API for `FT.*` (same `Query`, `AggregateRequest`, schema imports). Out of scope for v1 of this reference — see `redis-py`'s async tests under `tests/test_asyncio/test_search.py` for parallel examples. Sync semantics described above apply.
