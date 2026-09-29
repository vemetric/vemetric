
# RedisVL — Redis Search quick reference

This reference covers the **search / index / query surface** of RedisVL — the higher-level, schema-first Python SDK that builds on `redis-py`. It shows how RedisVL *expresses* the canonical CLI form via `IndexSchema`, `SearchIndex`, the query classes, and the `FilterExpression` DSL. It does not re-explain the query DSL grammar — that lives in [`../search-syntax-primitives.md`](../search-syntax-primitives.md).

- **redis-py (raw) equivalents** for the same operations: [`python-redis-py.md`](./python-redis-py.md). RedisVL is built on `redis-py`; an `FT.*` command that RedisVL does not wrap is reachable by calling `redis-py` directly through the index's underlying client (see §3). For tasks that are not RedisVL-specific (no schema, no vectorizer, no LLM primitive), prefer the `redis-py` reference.
- **Query DSL vocabulary** (delimiters, operators, escaping): [`../search-syntax-primitives.md`](../search-syntax-primitives.md). RedisVL's `FilterExpression` is a typed builder for that DSL — the grammar itself is not duplicated here.
- **Jedis (Java) equivalents** for cross-language verification of FT.* behaviour: [`java-jedis.md`](./java-jedis.md). RedisVL is Python-only; there is no Java equivalent.

Examples below trace to the upstream **RedisVL user-guide notebooks** under `redis/redis-vl-python/docs/user_guide/`. Each section cites the originating notebook. The shared **Bicycle dataset** is reused where it fits (filters, ranges, RAG-shape examples). For vectorizer demos that need text-embedding-friendly prose, the upstream notebook's small sentence/document dataset is preserved verbatim.

## Table of contents

1. [When to choose RedisVL over raw redis-py](#1-when-to-choose-redisvl-over-raw-redis-py)
2. [Minimum supported versions](#2-minimum-supported-versions)
3. [Connection](#3-connection)
4. [Schema definition — Python dict](#4-schema-definition--python-dict)
5. [Schema definition — YAML](#5-schema-definition--yaml)
6. [Storage type: HASH vs JSON](#6-storage-type-hash-vs-json)
7. [Index lifecycle](#7-index-lifecycle)
8. [FilterExpression DSL](#8-filterexpression-dsl)
9. [Query classes](#9-query-classes)
10. [Vectorizers](#10-vectorizers)
11. [Hybrid retrieval](#11-hybrid-retrieval)
12. [Async](#12-async)
13. [LLM primitives (summary level)](#13-llm-primitives-summary-level)
14. [Common errors & version gotchas](#14-common-errors--version-gotchas)
15. [Upstream examples index](#15-upstream-examples-index)


## 1. When to choose RedisVL over raw redis-py

redis-py equivalent: not applicable — see [`python-redis-py.md`](./python-redis-py.md) when none of the criteria below apply.

| Signal in the task | Pick |
|--------------------|------|
| Schema is declared up front (Python dict or YAML) and the agent is asked to "define an index" | RedisVL |
| Task names a `vectorizer` provider (OpenAI, HuggingFace, Cohere, Vertex, Azure OpenAI, Bedrock, Mistral, VoyageAI) and wants embeddings produced from text | RedisVL |
| Task involves LLM primitives (semantic cache, message history, semantic router) | RedisVL |
| Task is async-first and wants a clean async surface (`AsyncSearchIndex.query`, `.aembed_many`) | RedisVL |
| Task wants the lowest-level control over RESP commands or doesn't involve embeddings at all | raw `redis-py` ([`python-redis-py.md`](./python-redis-py.md)) |
| Task is "use FT.HYBRID directly with custom post-processing the high-level builder doesn't expose" | raw `redis-py` (drop through `index.client`) |
| Task mentions Jedis, Lettuce, node-redis, go-redis, NRedisStack | not RedisVL — RedisVL is Python only |

RedisVL builds on `redis-py`. The two are not mutually exclusive: when an `FT.*` command isn't wrapped at the RedisVL level, the same `SearchIndex` exposes its raw client via the public `index.client` property so an agent can fall through to the `redis-py` patterns described in [`python-redis-py.md`](./python-redis-py.md) without constructing a second connection. (The `index._redis_client` attribute also returns a client but is the internal lazy-init accessor — use `.client` in user code.)


## 2. Minimum supported versions

redis-py equivalent: see [`python-redis-py.md#1-minimum-supported-versions`](./python-redis-py.md#1-minimum-supported-versions).

| Component | Minimum | Notes |
|-----------|---------|-------|
| `redisvl` | **0.18.2** | RedisVL has evolved rapidly; older `0.x` releases predate `HybridQuery`, `AggregateHybridQuery`, `MultiVectorQuery`, and the consolidated `redisvl.extensions.*` import paths used below. Verified against upstream `pyproject.toml` at tag `v0.18.2`. |
| `redis-py` | **5.0** | RedisVL declares `redis>=5.0,<8.0` in its `pyproject.toml`. The library itself is a thin layer over `redis-py`. `HybridQuery` requires `redis-py >= 7.1.0` (the version that ships `FT.HYBRID` support) — see the dedicated row below. |
| `redis-py` (for `HybridQuery`) | **7.1.0** | `HybridQuery` import gates on `redis-py >= 7.1.0` at import time. Older `redis-py` cannot serialise `FT.HYBRID`. |
| Redis server (FT.SEARCH / FT.AGGREGATE) | **7.4** | Redis Search ships built-in from Redis 8.0; 7.4 still requires the RediSearch module. |
| Redis server (`FT.HYBRID` / `HybridQuery`) | **8.4.0** | Hard floor. Older Redis raises `unknown command 'FT.HYBRID'`. Fall back to the pre-filter + KNN pattern via `VectorQuery(filter_expression=...)`. See §11. |
| Python | 3.9+ | RedisVL 0.18 targets 3.9+. |

**DIALECT default:** RedisVL passes `DIALECT 2` on every query by default — every query class accepts a `dialect=` parameter that defaults to `2` (`VectorQuery`, `FilterQuery`, `RangeQuery`, `VectorRangeQuery`, `CountQuery`, `TextQuery`). You do **not** need to set it explicitly. GEOSHAPE `WITHIN`/`CONTAINS` predicates still require manually overriding to `dialect=3`.


## 3. Connection

redis-py equivalent: see [`python-redis-py.md#2-connection-setup`](./python-redis-py.md#2-connection-setup).

Three connection patterns, in order of preference. All three are equivalent in behaviour — pick the one that fits where the connection lives in your application.

```python
from redisvl.index import SearchIndex
from redis import Redis

# (a) Pass a redis-py client. Use this when the connection is managed elsewhere
#     (DI container, app factory, test fixture). Mirrors 01_getting_started.ipynb cell 9.
client = Redis.from_url("redis://localhost:6379")
index = SearchIndex.from_dict(schema, redis_client=client, validate_on_load=True)

# (b) Pass a URL string. RedisVL constructs the client internally. Mirrors cell 11.
index = SearchIndex.from_dict(schema, redis_url="redis://localhost:6379")

# (c) Default — connects to redis://localhost:6379 when neither is set.
index = SearchIndex.from_dict(schema)
```

`from_existing(name, ...)` rehydrates a `SearchIndex` from a server-side index that already exists (the schema is read back via `FT.INFO`):

```python
index = SearchIndex.from_existing("idx:bicycle", redis_url="redis://localhost:6379")
```

`validate_on_load=True` enables schema-shape validation on every `.load()` call — recommended in development, costly in tight write loops.

**Falling through to raw redis-py.** The underlying `redis-py` client is exposed for cases not covered by the high-level API:

```python
raw = index.client                       # SyncRedisClient (a redis.Redis instance)
raw.ft("idx:bicycle").execute_command("FT.SOMETHING", ...)
```

When you reach for `index.client`, switch to [`python-redis-py.md`](./python-redis-py.md) for the idioms.


## 4. Schema definition — Python dict

redis-py equivalent: see [`python-redis-py.md#3-schema-imports`](./python-redis-py.md#3-schema-imports) and `#5-create-index--json`. RedisVL declares the schema once as data; raw `redis-py` passes a tuple of `TextField` / `TagField` / etc. constructors plus an `IndexDefinition`.

The canonical schema shape — mirrors `01_getting_started.ipynb` cell 3:

```python
schema = {
    "index": {
        "name": "user_simple",
        "prefix": "user_simple_docs",
        # "storage_type": "hash" (default) or "json" — see §6
    },
    "fields": [
        {"name": "user",         "type": "tag"},
        {"name": "credit_score", "type": "tag"},
        {"name": "job",          "type": "text"},
        {"name": "age",          "type": "numeric"},
        {
            "name": "user_embedding",
            "type": "vector",
            "attrs": {
                "dims": 3,
                "distance_metric": "cosine",
                "algorithm": "flat",
                "datatype": "float32",
            },
        },
    ],
}
```

The dict goes to `SearchIndex.from_dict(schema)` — see §3 for the connection variants.

**Field types:** `tag`, `text`, `numeric`, `geo`, `vector`. Each maps to the corresponding `FT.CREATE` schema clause.

**Vector field algorithms:** `"flat"` for exact / small-scale (≤ ~1M vectors), `"hnsw"` for ANN, `"svs-vamana"` for SVS Vamana (advanced; Intel-optimised; mention as optional — see `09_svs_vamana.ipynb`).

> The schema above uses 3-dim toy embeddings from the upstream `01_getting_started.ipynb` notebook for brevity; the HNSW attrs block below shows the same schema shape with production-shape 1536 dims. `dims` must match whatever vectorizer or precomputed embedding produces the field's bytes — see §10.

**HNSW attributes** (added under `attrs`):

```python
{
    "name": "embedding",
    "type": "vector",
    "attrs": {
        "dims": 1536,
        "distance_metric": "cosine",
        "algorithm": "hnsw",
        "datatype": "float32",
        "m": 16,                    # max bidirectional links per node
        "ef_construction": 200,     # build-time exploration factor
        "ef_runtime": 10,           # default query-time exploration factor
    },
},
```

**JSON storage with nested paths.** Set `storage_type: "json"` at the index level and use JSONPath-style nested field names (RedisVL emits the path-and-alias for you):

```python
schema = {
    "index": {"name": "bike_index", "prefix": "bike:", "storage_type": "json"},
    "fields": [
        {"name": "name",            "type": "text"},
        {"name": "metadata.brand",  "type": "tag",     "path": "$.metadata.brand"},
        {"name": "metadata.price",  "type": "numeric", "path": "$.metadata.price"},
        # ...
    ],
}
```

The `name` is the query alias (`@metadata.brand`); the `path` is the underlying JSONPath. For top-level JSON fields the `path` defaults to `$.<name>`.


## 5. Schema definition — YAML

redis-py equivalent: not applicable. Raw `redis-py` has no YAML schema concept; you compose fields in code.

YAML is the recommended schema format for production — the file is checked into source control alongside the application and reused across sync/async/CLI consumers. Canonical shape — mirrors `redis/redis-vl-python` upstream `docs/user_guide/schema.yaml`:

```yaml
version: '0.1.0'

index:
  name: vectorizers
  prefix: doc
  storage_type: hash

fields:
  - name: sentence
    type: text
  - name: embedding
    type: vector
    attrs:
      dims: 768
      algorithm: flat
      distance_metric: cosine
```

Load with `from_yaml`:

```python
from redisvl.index import SearchIndex

index = SearchIndex.from_yaml(
    "schemas/bicycle.yaml",
    redis_url="redis://localhost:6379",
    validate_on_load=True,
)
```

Field shape under `fields:` mirrors the dict form in §4 — same `type`, `attrs`, `path`. The top-level `version:` field is the **schema-format** version, not the data version; upstream `docs/user_guide/schema.yaml` at tag `v0.18.2` pins it to `'0.1.0'`. RedisVL validates this format-version string at parse time — keep it `'0.1.0'` for RedisVL 0.18.x and bump only when a future RedisVL release introduces a new schema-format major.


## 6. Storage type: HASH vs JSON

redis-py equivalent: see [`python-redis-py.md#4-create-index--hash`](./python-redis-py.md#4-create-index--hash) and `#5-create-index--json`.

Mirrors `05_hash_vs_json.ipynb`. Set `storage_type` once in the schema; everything else follows.

```python
# HASH storage — default. Each Redis key holds a flat hash; field names are the schema names verbatim.
hash_schema = {
    "index": {"name": "user-hash", "prefix": "user-hash-docs", "storage_type": "hash"},
    "fields": [
        {"name": "user",            "type": "tag"},
        {"name": "office_location", "type": "geo"},
        {"name": "user_embedding",  "type": "vector",
         "attrs": {"dims": 3, "distance_metric": "cosine",
                   "algorithm": "flat", "datatype": "float32"}},
    ],
}
hindex = SearchIndex.from_dict(hash_schema, redis_url="redis://localhost:6379")
hindex.create(overwrite=True)
hindex.storage_type        # -> StorageType.HASH

# JSON storage — same fields, nested JSON document per key. Use JSONPath for nested fields.
json_schema = {
    "index": {"name": "user-json", "prefix": "user-json-docs", "storage_type": "json"},
    "fields": [
        {"name": "user",            "type": "tag"},
        {"name": "office_location", "type": "geo"},
        {"name": "user_embedding",  "type": "vector",
         "attrs": {"dims": 3, "distance_metric": "cosine",
                   "algorithm": "flat", "datatype": "float32"}},
    ],
}
jindex = SearchIndex.from_dict(json_schema, redis_url="redis://localhost:6379")
jindex.create(overwrite=True)
```

**Choosing between them:**

| Trade-off | HASH | JSON |
|-----------|------|------|
| Nested objects (`metadata.brand`) | Flatten yourself before load | Native — use JSONPath in `path:` |
| Partial document update | `HSET key field value` (RedisVL: `.load([{...}])` rewrites) | `JSON.SET key $.path value` |
| Vector encoding at load time | `np.ndarray(...).astype(np.float32).tobytes()` | `[0.1, 0.2, ...]` list (RedisVL converts) |
| Memory footprint per doc | Lower for flat docs | Higher (JSON metadata overhead) |
| Querying nested arrays | Not supported | `$.tags[*]` projections |

When in doubt for AI/RAG workloads, **JSON**: it preserves the natural shape of LLM outputs and allows nested metadata without flattening conventions. HASH wins when documents are already flat key-value structures.


## 7. Index lifecycle

redis-py equivalent: see [`python-redis-py.md#12-index-management`](./python-redis-py.md#12-index-management). RedisVL wraps the same `FT.CREATE` / `FT.DROPINDEX` / `FT.ALTER` / `FT.ALIAS*` commands behind methods on `SearchIndex`.

```python
# Create the index. overwrite=True drops and recreates; drop=True (with overwrite=True)
# also drops every existing indexed document.
index.create(overwrite=True, drop=False)

# Existence + introspection
index.exists()              # -> bool
index.info()                # -> dict from FT.INFO

# Load documents. Returns the list of full Redis keys written.
keys = index.load(data)                          # auto-generates document IDs
keys = index.load(data, id_field="user")         # use a field as the document ID
keys = index.load(data, ttl=3600)                # set per-document TTL

# Fetch by document ID (the unprefixed ID — RedisVL prepends the index prefix).
record = index.fetch("john")

# Delete by full key (with prefix) or by document ID (RedisVL adds the prefix).
index.drop_keys("user_simple_docs:01ABC...")
index.drop_documents("john")
index.drop_documents(["mary", "joe"])

# Clear: delete every indexed document but keep the index.
n_deleted = index.clear()

# Delete the index. drop=True (default) also deletes all indexed documents (FT.DROPINDEX ... DD);
# drop=False keeps the documents and removes only the index definition.
index.delete(drop=True)
```

`index.load(data)` is the bulk-write entry point. It accepts a list of dicts; each dict's keys must match the schema's field names (or the JSON path aliases for JSON-storage schemas). For HASH-storage vector fields the dict value must be `np.ndarray(...).astype(np.float32).tobytes()` (or use a vectorizer, see §10). For JSON-storage vector fields a plain `list[float]` works.

**Updating existing documents.** RedisVL 0.18.2 does **not** expose a dedicated `update_load(...)` method (the name appears in early proposals; it is not in the shipped API). To update existing indexed documents, call `.load(...)` again with explicit `keys=` matching the existing Redis keys, or with the same `id_field` value:

```python
# Re-load the same document IDs. HASH storage merges field-by-field at the Redis
# level (HSET semantics); JSON storage replaces the document.
keys = index.load(updated_data, id_field="user")

# Or write to explicit keys (must be full prefixed keys).
keys = index.load(updated_data, keys=["user_simple_docs:01ABC", "user_simple_docs:01DEF"])
```

The `preprocess=` parameter accepts a callable applied to each item before write — useful for normalising shape or computing derived fields. `validate_on_load=True` (set on the index) re-runs schema validation on every `.load()` call.

`paginate(query, page_size=N)` is the recommended way to walk large result sets without holding everything in memory — yields batches of result dicts:

```python
from redisvl.query import FilterQuery
from redisvl.query.filter import FilterExpression

query = FilterQuery(filter_expression=FilterExpression("*"), return_fields=["user", "age", "job"])
for batch in index.paginate(query, page_size=100):
    for doc in batch:
        process(doc)
```

**Mirrors `01_getting_started.ipynb` cells 13, 18, 23, 26, 28, 30, 32, 33.**


## 8. FilterExpression DSL

redis-py equivalent: see [`python-redis-py.md#6-ftsearch-idioms`](./python-redis-py.md#6-ftsearch-idioms) for raw query strings. The full DSL grammar lives in [`../search-syntax-primitives.md`](../search-syntax-primitives.md); this section shows only how RedisVL's typed `FilterExpression` *compiles to* that grammar.

The four filter classes mirror the four indexable scalar types — `Tag`, `Text`, `Num`, `Geo` — plus `Timestamp` (a `Num` subclass that accepts `datetime` objects). All five live in `redisvl.query.filter`. Operators are overloaded: `==`, `!=`, `<`, `>`, `<=`, `>=`, `%` (text wildcard/fuzzy), `&` (AND), `|` (OR), `~` (NOT — used via `!=`).

### Tag — mirrors `02_complex_filtering.ipynb` cells 8, 10, 12

```python
from redisvl.query.filter import Tag

Tag("credit_score") == "high"                       # @credit_score:{high}
Tag("credit_score") != "high"                       # -@credit_score:{high}
Tag("credit_score") == ["high", "medium"]           # @credit_score:{high|medium}
Tag("credit_score") == set(["high", "medium"])      # same; set enforces uniqueness
Tag("credit_score") == []                           # gracefully -> "*" (no constraint)
```

### Num — mirrors cells 17, 18, 19

```python
from redisvl.query.filter import Num

Num("age").between(15, 35)        # @age:[15 35]
Num("age") == 14                  # @age:[14 14]
Num("age") != 14                  # -@age:[14 14]
Num("age") < 18                   # @age:[-inf (18]
Num("age") >= 18                  # @age:[18 +inf]
```

### Text — mirrors cells 25, 26, 27, 28, 29

```python
from redisvl.query.filter import Text

Text("job") == "doctor"           # @job:"doctor"
Text("job") != "doctor"           # -@job:"doctor"
Text("job") % "doct*"             # @job:doct*  (wildcard / prefix)
Text("job") % "%%engine%%"        # @job:%%engine%%  (fuzzy, Levenshtein 2)
Text("job") % "engineer|doctor"   # @job:(engineer|doctor)
Text("job") % ""                  # gracefully -> "*"
```

### Geo — mirrors cells 34, 35, 36

```python
from redisvl.query.filter import Geo, GeoRadius

Geo("office_location") == GeoRadius(-122.4194, 37.7749, 10, "km")    # @office_location:[-122.4194 37.7749 10 km]
Geo("office_location") != GeoRadius(-122.4194, 37.7749, 10, "km")    # -@office_location:[...]
```

### Timestamp — mirrors cells 21–23

```python
from redisvl.query.filter import Timestamp
from datetime import datetime

dt = datetime(2025, 3, 16, 13, 45, 39)
Timestamp("last_updated") > dt                    # @last_updated:[(<epoch> +inf]
Timestamp("last_updated").between(dt1, dt2)       # @last_updated:[<epoch1> <epoch2>]
```

`Timestamp` converts `datetime` to epoch seconds and emits a `NUMERIC` range — the underlying field must be declared `type: numeric` and stored as epoch seconds.

### Composition — mirrors cells 38, 40, 42

Boolean operators compose any filter into a single expression:

```python
t  = Tag("credit_score") == "high"
lo = Num("age") >= 18
hi = Num("age") <= 100
ts = Timestamp("last_updated") > datetime(2025, 3, 16, 13, 45, 39)

combined = t & lo & hi & ts                       # AND
either   = (Num("age") < 18) | (Num("age") > 93)  # OR

# Defensive composition — empty filters fall back to "*", so partial inputs compose cleanly.
def make_filter(age=None, credit=None, job=None):
    return (
        (Num("age") > age) &
        (Tag("credit_score") == credit) &
        (Text("job") % job)
    )
```

Pass the resulting `FilterExpression` to any query class via `filter_expression=`:

```python
from redisvl.query import VectorQuery

v = VectorQuery(
    vector=[0.1, 0.1, 0.5],
    vector_field_name="user_embedding",
    return_fields=["user", "credit_score", "age", "job", "office_location"],
    filter_expression=combined,
)
```

Or swap the filter on an existing query without rebuilding it:

```python
v.set_filter(Tag("credit_score") != "high")
```

`str(filter_expression)` returns the compiled query string — useful for logging or for verifying what RedisVL emits before sending it to Redis.


## 9. Query classes

redis-py equivalent: see [`python-redis-py.md#6-ftsearch-idioms`](./python-redis-py.md#6-ftsearch-idioms) (FT.SEARCH) and `#7-ftaggregate-idioms` (FT.AGGREGATE). RedisVL's query classes route to either depending on shape.

All seven live under `redisvl.query`. Pass an instance to `index.query(...)` — RedisVL picks the right underlying command:

| Class | Wraps | Use for |
|-------|-------|---------|
| `VectorQuery` | FT.SEARCH with `=>[KNN K @field $vec AS score]` | Top-K nearest neighbours, pre-filterable via `filter_expression=`. |
| `VectorRangeQuery` (also exported as `RangeQuery`) | FT.SEARCH with `=>[VECTOR_RANGE radius $vec]` | All hits within a distance threshold of the query vector. |
| `FilterQuery` | FT.SEARCH on a `FilterExpression` (no vector) | Plain filtered retrieval; pagination via `index.paginate(query, page_size=N)`. |
| `CountQuery` | FT.SEARCH `... LIMIT 0 0` | Count documents matching a filter without fetching them. |
| `TextQuery` | FT.SEARCH with full-text scoring | BM25/TFIDF-scored full-text retrieval over `text` fields. |
| `AggregationQuery` | FT.AGGREGATE | Group-by + reduce pipelines. Inherits from `redis-py`'s `AggregateRequest` — fluent API matches. |
| `HybridQuery` | FT.HYBRID (Redis ≥ 8.4.0) | Native blended text + vector ranking. See §11. |

### VectorQuery — KNN with optional pre-filter

Mirrors `01_getting_started.ipynb` cell 36 + `02_complex_filtering.ipynb` cell 8.

```python
from redisvl.query import VectorQuery
from redisvl.query.filter import Tag, Num

# Top-3 nearest, no filter.
query = VectorQuery(
    vector=[0.1, 0.1, 0.5],
    vector_field_name="user_embedding",
    return_fields=["user", "age", "job", "credit_score", "vector_distance"],
    num_results=3,
)
results = index.query(query)

# Pre-filtered KNN — filter is applied before the vector scan.
query = VectorQuery(
    vector=[0.1, 0.1, 0.5],
    vector_field_name="user_embedding",
    return_fields=["user", "credit_score", "age", "vector_distance"],
    num_results=3,
    filter_expression=(Tag("credit_score") == "high") & (Num("age").between(18, 60)),
)
results = index.query(query)
```

`results` is a `list[dict]` — each dict carries the returned fields plus `id` and (when the vector_distance alias is in `return_fields`) the distance score.

### VectorRangeQuery — within a distance threshold

```python
from redisvl.query import VectorRangeQuery
# Backwards-compatible alias — RangeQuery is a thin subclass kept for older code paths.
from redisvl.query import RangeQuery  # `class RangeQuery(VectorRangeQuery): pass` in redisvl/query/query.py

range_q = VectorRangeQuery(
    vector=[0.1, 0.1, 0.5],
    vector_field_name="user_embedding",
    return_fields=["user", "vector_distance"],
    distance_threshold=0.5,        # COSINE distance in [0, 2]
    num_results=10,                 # cap on returned results
)
results = index.query(range_q)
```

Mirrors `docs/user_guide/11_advanced_queries.ipynb` (distance-threshold pattern; the notebook uses the equivalent `filter_expression` + `VectorQuery` shape rather than `VectorRangeQuery` directly — the class is exercised by `tests/integration/test_query.py`).

### FilterQuery — pure filter retrieval

Mirrors `01_getting_started.ipynb` cell 30.

```python
from redisvl.query import FilterQuery
from redisvl.query.filter import Tag

query = FilterQuery(
    filter_expression=Tag("credit_score") == "high",
    return_fields=["user", "age", "job"],
    num_results=50,
)

# Paginate large result sets — recommended over num_results for full scans.
for batch in index.paginate(query, page_size=100):
    for doc in batch:
        process(doc)
```

### CountQuery — count without fetching

```python
from redisvl.query import CountQuery
from redisvl.query.filter import Tag

count = index.query(CountQuery(filter_expression=Tag("brand") == "Nike"))
# Returns the integer match count; emits FT.SEARCH ... LIMIT 0 0 under the hood.
```

Source: `redisvl.query.CountQuery` (`redisvl/query/query.py` — class at module scope). Exercised by `tests/integration/test_query.py`; the user-guide notebooks favour `FilterQuery` over `CountQuery` for didactic reasons (showing the fetched docs), but the class is a stable part of the v0.18.2 public API.

### TextQuery — full-text scored retrieval

Mirrors `11_advanced_queries.ipynb` cells 8, 10, 13.

```python
from redisvl.query import TextQuery
from redisvl.query.filter import Tag, Num

# Plain text search with BM25STD (default scorer).
text_query = TextQuery(
    text="running shoes",
    text_field_name="brief_description",
    return_fields=["product_id", "brief_description", "category", "price"],
    num_results=5,
)

# Add a filter expression to scope the search.
filtered = TextQuery(
    text="comfortable",
    text_field_name="brief_description",
    filter_expression=Num("price") < 100,
    return_fields=["product_id", "brief_description", "price"],
)

# Multi-field weighting — search across multiple text fields with per-field weights.
weighted = TextQuery(
    text="shoes",
    text_field_name={"brief_description": 1.0, "full_description": 0.5},
    return_fields=["product_id", "brief_description"],
)

# Stopword handling — "english" is the default; pass a custom list or None to disable.
with_stopwords = TextQuery(text="the best shoes", text_field_name="brief_description", stopwords="english")
custom_stop    = TextQuery(text="best shoes", text_field_name="brief_description", stopwords=["for", "with"])
no_stopwords   = TextQuery(text="the best shoes", text_field_name="brief_description", stopwords=None)
```

**Scorers:** `TFIDF`, `TFIDF.DOCNORM`, `BM25STD` (default), `BM25STD.NORM`, `BM25STD.TANH`, `DISMAX`, `DOCSCORE`, `HAMMING`. See `11_advanced_queries.ipynb` cells 10–11.

### AggregationQuery — FT.AGGREGATE shape

`AggregationQuery` lives at `redisvl.query.AggregationQuery` (`redisvl/query/aggregate.py`) and subclasses `redis-py`'s `AggregateRequest`. Its constructor takes a single `query_string` (the FT.AGGREGATE filter expression) and the inherited fluent API matches the one in [`python-redis-py.md#7-ftaggregate-idioms`](./python-redis-py.md#7-ftaggregate-idioms) — `.load()`, `.apply()`, `.group_by()`, `.filter()`, `.sort_by()`, `.limit()`, `.cursor()`.

```python
from redisvl.query import AggregationQuery
from redis.commands.search import reducers

# Top-3 brands by document count, descending — `*` matches all docs.
agg = (
    AggregationQuery("*")
    .group_by("@brand", reducers.count().alias("n"))
    .sort_by(("@n", "DESC"))
    .limit(0, 3)
)
results = index.aggregate(agg)
```

Route through `index.aggregate(...)` when you want the RedisVL result-shape normalisation; the underlying command is FT.AGGREGATE on the index's name. The reducer factories live in `redis.commands.search.reducers` (imported from `redis-py`) — RedisVL does not re-export them. `redisvl/query/aggregate.py` declares only the subclass plus `AggregateHybridQuery`, `MultiVectorQuery`, and `Vector`; the fluent surface is inherited verbatim. The user-guide notebooks (`11_advanced_queries.ipynb`) cover the related `AggregateHybridQuery` (cells 34, 37, 42) but do not include a worked `AggregationQuery` example — see `tests/integration/test_aggregation.py` for executable references.

### SVS Vamana (advanced / optional)

`09_svs_vamana.ipynb` covers Intel's SVS Vamana vector algorithm. Treat it as advanced/optional in v1: it requires a Redis build with SVS support (Intel-optimised) and adds tuning parameters orthogonal to the HNSW/FLAT trade-offs. Declare it via `"algorithm": "svs-vamana"` in the vector field's `attrs`. Most agents should pick FLAT (≤ ~1M vectors) or HNSW (ANN at scale) and only reach for SVS Vamana when explicitly asked.


## 10. Vectorizers

redis-py equivalent: not applicable. Raw `redis-py` has no vectorizer concept — you compute the embedding yourself and pass the raw `bytes` blob into the query (`np.array(...).astype(np.float32).tobytes()`). RedisVL's vectorizers wrap that pattern plus the provider-specific HTTP/SDK call.

### Canonical example — OpenAI

Mirrors `04_vectorizers.ipynb` cells 4–7:

```python
import os
from redisvl.utils.vectorize import OpenAITextVectorizer

oai = OpenAITextVectorizer(
    model="text-embedding-ada-002",                   # or text-embedding-3-small / -3-large
    api_config={"api_key": os.environ["OPENAI_API_KEY"]},
)

# Single embedding.
vec = oai.embed("This is a test sentence.")
print(len(vec))                                       # 1536 for ada-002 / 3-small

# Batch.
sentences = ["That is a happy dog", "That is a happy person", "Today is a sunny day"]
embeddings = oai.embed_many(sentences)

# Async batch — vectorizers expose .aembed_many and .aembed for async use.
embeddings = await oai.aembed_many(sentences)
```

Vectorizers all expose the same surface: `.embed(text)`, `.embed_many(texts)`, `.aembed(text)`, `.aembed_many(texts)`. Pass `as_buffer=True` to `embed_many` to get RedisVL's binary buffer format suitable for direct write into HASH-storage vector fields without the `np.array(...).tobytes()` conversion.

### Provider table

All providers live under `redisvl.utils.vectorize`. Mirrors `redisvl/utils/vectorize/__init__.py`.

| Class | Provider | Auth | Typical default dim | Upstream notebook cell |
|-------|----------|------|---------------------|------------------------|
| `OpenAITextVectorizer` | OpenAI | `api_config={"api_key": ...}` (or `OPENAI_API_KEY`) | 1536 (`ada-002`, `3-small`); 3072 (`3-large`) | `04_vectorizers.ipynb` 4–7 |
| `AzureOpenAITextVectorizer` | Azure OpenAI | `api_config={"api_key", "api_version", "azure_endpoint"}` | Matches deployment | cells 9–11 |
| `HFTextVectorizer` | HuggingFace (local `sentence-transformers`) | None (local model) | Model-dependent (768 for `all-mpnet-base-v2`) | cells 13–14 |
| `VertexAITextVectorizer` (`VertexAIVectorizer`) | Google Vertex AI | `api_config={"project_id", "location", "google_application_credentials"}` | 768 (`text-embedding-005`) | cell 16 |
| `CohereTextVectorizer` | Cohere | `api_config={"api_key": ...}` (or `COHERE_API_KEY`) | 1024 (`embed-english-v3.0`) | cells 18+ |
| `BedrockTextVectorizer` (`BedrockVectorizer`) | AWS Bedrock | AWS credentials via boto3 env / profile | 1024 (`amazon.titan-embed-text-v1`) | bedrock cells |
| `VoyageAITextVectorizer` (`VoyageAIVectorizer`) | VoyageAI | `api_config={"api_key": ...}` | 1024 (`voyage-3`) | voyage cells |
| `MistralAITextVectorizer` | Mistral | `api_config={"api_key": ...}` | 1024 (`mistral-embed`) | — |
| `CustomTextVectorizer` (`CustomVectorizer`) | Your own callable | n/a — you pass a `embed` function | Your model | custom-vectorizer section |

RedisVL vectorizers auto-detect the model's dim on first call for known providers — you only need to set `dims` in the schema when the vectorizer doesn't expose it (e.g., custom). When `dims` in the schema disagrees with what the vectorizer produces, `.load()` raises a dimension-mismatch error at write time.


## 11. Hybrid retrieval

redis-py equivalent: see [`python-redis-py.md#10-fthybrid`](./python-redis-py.md#10-fthybrid). RedisVL exposes the same `FT.HYBRID` surface through `HybridQuery` and `AggregateHybridQuery`.

**Version gate:** `HybridQuery` requires **Redis ≥ 8.4.0** and `redis-py >= 7.1.0`. On older Redis or older `redis-py`, fall back to the **pre-filter + KNN** pattern via `VectorQuery(filter_expression=...)` — see below. The upstream `11_advanced_queries.ipynb` gates every `HybridQuery` example on a `HYBRID_SEARCH_AVAILABLE` flag (cells 32, 36, 39, 41).

### Native FT.HYBRID — `HybridQuery`

Mirrors `11_advanced_queries.ipynb` cell 32:

```python
from redisvl.query import HybridQuery

hybrid_query = HybridQuery(
    text="running shoes",
    text_field_name="brief_description",
    vector=[0.1, 0.2, 0.1],                       # query vector
    vector_field_name="text_embedding",
    return_fields=["product_id", "brief_description", "category", "price"],
    num_results=5,
    yield_text_score_as="text_score",
    yield_vsim_score_as="vector_similarity",
    combination_method="LINEAR",                  # or "RRF" (server default)
    linear_alpha=0.3,                             # 30% text, 70% vector
    yield_combined_score_as="hybrid_score",
)

results = index.query(hybrid_query)
```

**Combination methods:**

- `combination_method="RRF"` — Reciprocal Rank Fusion. Rank-based, robust without weight tuning. Knobs: `rrf_window` (default 20), `rrf_constant` (default 60).
- `combination_method="LINEAR"` — weighted score blend. Knob: `linear_alpha` (text weight; `1 - alpha` is the implicit vector weight).

**Scorers** (text leg): same options as `TextQuery` — `BM25STD` (default), `TFIDF`, `DISMAX`, etc.

**Filter expressions** apply to both legs:

```python
filtered_hybrid = HybridQuery(
    text="professional equipment",
    text_field_name="brief_description",
    vector=[0.9, 0.1, 0.05],
    vector_field_name="text_embedding",
    filter_expression=Num("price") > 100,
    combination_method="LINEAR",
    yield_text_score_as="text_score",
    yield_vsim_score_as="vector_similarity",
    yield_combined_score_as="hybrid_score",
)
```

### Aggregate-shaped hybrid — `AggregateHybridQuery`

When you want the FT.AGGREGATE-shape output (rows, group-by stages) instead of the FT.SEARCH-shape:

```python
from redisvl.query import AggregateHybridQuery

agg_hybrid = AggregateHybridQuery(
    text="running shoes",
    text_field_name="brief_description",
    vector=[0.1, 0.2, 0.1],
    vector_field_name="text_embedding",
    return_fields=["product_id", "brief_description", "category", "price"],
    alpha=0.7,                                    # 70% vector, 30% text
    num_results=5,
)
results = index.query(agg_hybrid)
```

### Fallback for Redis < 8.4.0 — pre-filter + KNN

When `FT.HYBRID` is unavailable, blend retrieval by applying the text filter as a **pre-filter** on the vector query:

```python
from redisvl.query import VectorQuery
from redisvl.query.filter import Text, Num

query = VectorQuery(
    vector=query_vector,
    vector_field_name="text_embedding",
    return_fields=["product_id", "brief_description", "price", "vector_distance"],
    num_results=10,
    # Pre-filter shrinks the candidate set before the KNN scan.
    filter_expression=(Text("brief_description") % "running") & (Num("price") < 200),
)
results = index.query(query)
```

This is **not** the same operation as `FT.HYBRID`: it filters by text but ranks purely by vector distance. Use it when (a) the Redis version doesn't support `FT.HYBRID`, or (b) the workload only needs filtered KNN, not blended ranking. The upstream `02_complex_filtering.ipynb` cell 8 demonstrates the pattern in its native shape.


## 12. Async

redis-py equivalent: see [`python-redis-py.md`](./python-redis-py.md) footer (async out of scope for v1).

`AsyncSearchIndex` mirrors `SearchIndex` method-for-method on the search/index/query surface. Async parity is **at full coverage** for the operations relevant to this reference — `create`, `delete`, `load`, `fetch`, `query`, `paginate` (async generator), `aggregate`, `search`, `clear`, `drop_keys`, `drop_documents`, `expire_keys`, `exists`, `info`, `listall`.

```python
from redisvl.index import AsyncSearchIndex
from redis.asyncio import Redis

client = Redis.from_url("redis://localhost:6379")
index = AsyncSearchIndex.from_dict(schema, redis_client=client)

await index.create(overwrite=True, drop=False)
await index.load(data)

# Same query classes; same construction.
from redisvl.query import VectorQuery
query = VectorQuery(vector=[0.1, 0.1, 0.5], vector_field_name="user_embedding",
                    return_fields=["user", "age"], num_results=3)
results = await index.query(query)

await index.delete(drop=True)
```

Mirrors `01_getting_started.ipynb` cells 41–47.

**Divergences from the sync API:**

- `from_existing(...)` is async on `AsyncSearchIndex` — `await AsyncSearchIndex.from_existing(name, redis_url=...)`. Sync is `SearchIndex.from_existing(name, redis_url=...)`.
- `connect(...)` and `set_client(...)` are async.
- `paginate` is an async generator: `async for batch in index.paginate(query, page_size=N):`.
- No context-manager support equivalent to `SearchIndex.__enter__` / `__exit__` — manage lifetime manually with `await index.disconnect()`.

Vectorizers expose `.aembed(text)` and `.aembed_many(texts)` for the embedding call itself — pair them with `AsyncSearchIndex` for end-to-end async pipelines (see §10).


## 13. LLM primitives (summary level)

Full coverage of the LLM-primitive surface is deferred to a future dedicated spec. The summaries below are intentionally narrow — minimal constructor + the upstream notebook to read for depth. None of these primitives are necessary for the core search/index/query surface this reference covers.

### SemanticCache — semantic prompt → response cache

Mirrors `03_llmcache.ipynb` cell 5.

```python
from redisvl.extensions.cache.llm import SemanticCache
from redisvl.utils.vectorize import HFTextVectorizer

llmcache = SemanticCache(
    name="llmcache",                                              # underlying search index name
    redis_url="redis://localhost:6379",
    distance_threshold=0.1,                                       # cosine distance [0, 2]; lower = stricter
    vectorizer=HFTextVectorizer("redis/langcache-embed-v2"),
)

llmcache.store(prompt="What is the capital of France?", response="Paris")
hit = llmcache.check(prompt="capital city of France?")          # returns cached response on semantic match
```

`filterable_fields=[{"name": "user_id", "type": "tag"}]` partitions the cache by tenant/user. Defer to `03_llmcache.ipynb` for filterable-field semantics, TTLs, and metadata.

**LangCache vs SemanticCache:** `SemanticCache` is the in-process Python class shown above. **LangCache** (`13_langcache_semantic_cache.ipynb`) is a separate Redis-hosted product — a managed semantic-cache service on Redis Cloud. They share a vector-search shape but live in different scopes. For LangCache coverage, fall through to the `redis-semantic-cache` skill (a separate skill in this repo) rather than treating it inline as a RedisVL primitive.

### MessageHistory — durable chat-history with optional semantic recall

Mirrors `07_message_history.ipynb` cells 1, 12.

```python
from redisvl.extensions.message_history import MessageHistory, SemanticMessageHistory

# Plain FIFO chat history.
chat = MessageHistory(name="student tutor")
chat.add_message({"role": "user", "content": "Explain backprop."})
recent = chat.get_recent(top_k=8)

# Vector-recall over the same history — fetches semantically similar past turns.
semantic = SemanticMessageHistory(name="tutor")
semantic.add_messages(recent)
relevant = semantic.get_relevant("How does gradient descent relate to backprop?")
```

Defer to `07_message_history.ipynb` for session tagging, role filtering, TTLs.

### SemanticRouter — route a query to a labelled bucket via vector match

Mirrors `08_semantic_router.ipynb` cells 2, 4.

```python
from redisvl.extensions.router import SemanticRouter, Route
from redisvl.utils.vectorize import HFTextVectorizer

tech = Route(
    name="technology",
    references=["what are the latest advancements in AI?", "tell me about the newest gadgets"],
    metadata={"category": "tech"},
    distance_threshold=0.71,
)

router = SemanticRouter(
    name="topic-router",
    vectorizer=HFTextVectorizer(),
    routes=[tech, ...],
    redis_url="redis://localhost:6379",
    overwrite=True,
)

match = router("what's new in machine learning?")           # -> Route name + score
```

Defer to `08_semantic_router.ipynb` for multi-route disambiguation, `from_dict` / `from_yaml` persistence, and threshold tuning.

### Other extensions (also summary-only)

- **EmbeddingsCache** (`redisvl.extensions.cache.embeddings.EmbeddingsCache`) — cache for `embed()` calls to avoid recomputation. See `10_embeddings_cache.ipynb`.
- **Rerankers** (`redisvl.utils.rerank`) — `HFCrossEncoderReranker`, `CohereReranker`, `VoyageAIReranker` for second-stage cross-encoder reranking after initial vector retrieval. See `06_rerankers.ipynb`.


## 14. Common errors & version gotchas

redis-py equivalent: see [`python-redis-py.md#13-common-errors--version-gotchas`](./python-redis-py.md#13-common-errors--version-gotchas).

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `redis.exceptions.ResponseError: unknown command 'FT.HYBRID'` from `HybridQuery` | Redis server < 8.4.0 or `redis-py` < 7.1.0. | Upgrade both, or fall back to pre-filter + `VectorQuery` (§11). |
| `_IMPORT_ERROR_MESSAGE = "Hybrid queries require Redis >= 8.4.0 and redis-py>=7.1.0"` | Importing `HybridQuery` against an older `redis-py`. | Upgrade `redis-py`; gate import on `try`/`except ImportError`. |
| `Vector dimension mismatch` on `.load()` | Vectorizer output dim ≠ schema `dims`. | Set `dims` to match the vectorizer's actual output, or pick a model whose dim matches the schema. |
| `.load()` raises `ValidationError` | `validate_on_load=True` and a doc has wrong shape (missing field, wrong type). | Either fix the doc or set `validate_on_load=False` (test/dev only). |
| Vector query returns 0 hits despite obvious matches | HASH-storage vector field was loaded with a `list[float]` instead of `np.array(...).astype(np.float32).tobytes()`. | For HASH: convert to bytes. For JSON: lists work natively. |
| GEOSHAPE WITHIN/CONTAINS returns syntax error | RedisVL defaults to DIALECT 2; `WITHIN`/`CONTAINS` need DIALECT 3. | Pass `dialect=3` on the query class. |
| `OPENAI_API_KEY` `AuthenticationError` from `OpenAITextVectorizer` | Missing env var or wrong key passed to `api_config`. | Set `OPENAI_API_KEY` in the env, or pass `api_config={"api_key": "..."}` explicitly. |
| `AttributeError: 'SearchIndex' object has no attribute 'X'` after a RedisVL minor upgrade | RedisVL renamed/moved an API between minors (`0.x` is pre-1.0). | Pin RedisVL to a known-good version in `requirements.txt`; check the changelog before upgrading. |
| `ImportError: cannot import name 'HybridQuery' from 'redisvl.query'` | RedisVL < 0.18 (or `redis-py` < 7.1.0 at install time). | Upgrade RedisVL to ≥ 0.18 and `redis-py` to ≥ 7.1.0. |
| `AsyncSearchIndex.from_existing(...)` raises "coroutine was never awaited" | The sync API was used. | `await AsyncSearchIndex.from_existing(...)` — async-side method is a coroutine. |
| `index.query(query)` returns rows where every field is `None` | The dict's `return_fields` was empty AND the index is JSON-storage. | Explicitly pass `return_fields=[...]` — RedisVL doesn't auto-return the full JSON doc. |
| `index.create()` errors `Index already exists` on re-run | `.create()` is not idempotent without `overwrite=True`. | `.create(overwrite=True)` for dev bootstrap; gate on `.exists()` for production. |

**DIALECT defaults:** RedisVL passes `dialect=2` on every query class by default. You do not need to set it. Override to `dialect=3` for GEOSHAPE `WITHIN`/`CONTAINS`. The Redis server default (DIALECT 2 from Redis 8.0+) does not affect RedisVL because RedisVL always sends DIALECT explicitly.

**`rvl` CLI tool:** the `rvl` CLI (`rvl index info`, `rvl stats`, `rvl index list`) is a productivity tool for inspecting indexes from the shell. Deferred from v1 of this reference — agents generating Python code rarely need it. See `cli.ipynb` upstream.


## 15. Upstream examples index

redis-py equivalent: see [`python-redis-py.md#14-upstream-examples-index`](./python-redis-py.md#14-upstream-examples-index).

Curated mapping of operation → notebook + cell. Upstream files live at `https://github.com/redis/redis-vl-python/blob/main/docs/user_guide/<file>`. Source classes live in `redis/redis-vl-python/redisvl/...`.

| Operation | Notebook + cell | Upstream class / method |
|-----------|-----------------|-------------------------|
| Schema dict (`index`, `fields`, `attrs`) | `01_getting_started.ipynb` cell 3 | `IndexSchema.from_dict` (`redisvl/schema/schema.py`) |
| `SearchIndex` construction (client / URL / default) | `01_getting_started.ipynb` cells 9, 11 | `SearchIndex.__init__`, `.from_dict`, `.from_yaml` (`redisvl/index/index.py`) |
| `index.create(overwrite=True)` | cell 13 | `SearchIndex.create` |
| `index.load(data)` | cell 18 | `SearchIndex.load` |
| `index.load(data, id_field="user")` + `index.fetch("john")` | cell 26 | `SearchIndex.load`, `.fetch` |
| `index.key("john")` | cell 28 | `SearchIndex.key` |
| `FilterQuery` + `index.paginate(query, page_size=...)` | cell 30 | `redisvl.query.FilterQuery`, `SearchIndex.paginate` |
| `index.drop_keys` / `.drop_documents` | cells 32–33 | `SearchIndex.drop_keys`, `.drop_documents` |
| `VectorQuery` KNN | cell 36 | `redisvl.query.VectorQuery` |
| `VectorRangeQuery` / `RangeQuery` (distance threshold) | not in user-guide notebooks — see `tests/integration/test_query.py` | `redisvl.query.VectorRangeQuery`, `RangeQuery` (`redisvl/query/query.py`) |
| `CountQuery` (FT.SEARCH ... LIMIT 0 0) | not in user-guide notebooks — see `tests/integration/test_query.py` | `redisvl.query.CountQuery` (`redisvl/query/query.py`) |
| `AggregationQuery` fluent (`.group_by` / `.reduce` / `.sort_by`) | not in user-guide notebooks — see `tests/integration/test_aggregation.py` | `redisvl.query.AggregationQuery` (`redisvl/query/aggregate.py`), inherits `AggregateRequest` from `redis.commands.search.aggregation` |
| `AsyncSearchIndex` + async query | cells 41–47 | `AsyncSearchIndex.__init__`, `.query` |
| Schema mutate: `remove_field` + `add_fields` | cell 45 | `IndexSchema.remove_field`, `.add_fields` |
| `Tag(field) == value` | `02_complex_filtering.ipynb` cell 8 | `redisvl.query.filter.Tag` |
| `Tag != / list / set / empty` | cells 10, 12, 13, 15 | `Tag.__eq__`, `__ne__` |
| `Num.between` / `==` / `!=` | cells 17–19 | `redisvl.query.filter.Num` |
| `Timestamp > / < / .between` | cells 21–23 | `redisvl.query.filter.Timestamp` |
| `Text == / != / %` (wildcard, fuzzy, `engineer|doctor`) | cells 25–29 | `redisvl.query.filter.Text` |
| `Geo == GeoRadius(lon, lat, r, units)` | cells 34–36 | `redisvl.query.filter.Geo`, `GeoRadius` |
| Boolean composition `&`, `\|` | cells 38, 40 | `FilterExpression.__and__`, `__or__` |
| `OpenAITextVectorizer.embed` / `.embed_many` / `.aembed_many` | `04_vectorizers.ipynb` cells 5–7 | `redisvl.utils.vectorize.OpenAITextVectorizer` |
| `AzureOpenAITextVectorizer` setup | cells 9–11 | `redisvl.utils.vectorize.AzureOpenAITextVectorizer` |
| `HFTextVectorizer` (local sentence-transformers) | cells 13–14 | `redisvl.utils.vectorize.HFTextVectorizer` |
| `VertexAIVectorizer` setup | cell 16 | `redisvl.utils.vectorize.VertexAIVectorizer` |
| HASH-storage schema + `.create` | `05_hash_vs_json.ipynb` cells 5–6 | `SearchIndex.from_dict` with `storage_type: hash` |
| JSON-storage schema + `.create` | cells 16–17 | `SearchIndex.from_dict` with `storage_type: json` |
| Bike-data + nested JSON metadata | cells 26–27 | (Bicycle-shaped dataset for downstream RAG examples) |
| `TextQuery` BM25 / TFIDF / weighted / stopwords | `11_advanced_queries.ipynb` cells 8–20 | `redisvl.query.TextQuery` |
| `FilterQuery` for STOPWORDS-0 raw query | cell 26 | `redisvl.query.FilterQuery` |
| `HybridQuery` LINEAR + RRF + filter | cells 32, 36, 39, 41 | `redisvl.query.HybridQuery` |
| `AggregateHybridQuery` | cells 34, 37 | `redisvl.query.AggregateHybridQuery` |
| `SemanticCache` constructor + `.store` / `.check` | `03_llmcache.ipynb` cell 5 | `redisvl.extensions.cache.llm.SemanticCache` |
| `SemanticCache` with `filterable_fields` | cells 41, 45 | `SemanticCache(filterable_fields=[...])` |
| `MessageHistory` / `SemanticMessageHistory` | `07_message_history.ipynb` cells 1, 12 | `redisvl.extensions.message_history.MessageHistory`, `SemanticMessageHistory` |
| `SemanticRouter` + `Route` | `08_semantic_router.ipynb` cells 2, 4 | `redisvl.extensions.router.SemanticRouter`, `Route` |
| `SemanticRouter.from_yaml` | cell 21 | `SemanticRouter.from_yaml` |
| Canonical `schema.yaml` | `docs/user_guide/schema.yaml` | `IndexSchema.from_yaml` |
| SVS Vamana algorithm (advanced) | `09_svs_vamana.ipynb` | `"algorithm": "svs-vamana"` in vector field `attrs` |
| `EmbeddingsCache` | `10_embeddings_cache.ipynb` | `redisvl.extensions.cache.embeddings.EmbeddingsCache` |
| `rvl` CLI (deferred) | `cli.ipynb` | Out of scope for v1 |
| LangCache (Redis-hosted product) | `13_langcache_semantic_cache.ipynb` | Cross-link to the `redis-semantic-cache` skill |
