---
name: redis-search
description: Redis Search guidance covering FT.CREATE schema design, field type selection (TEXT, TAG, NUMERIC, GEO, GEOSHAPE, VECTOR, JSON path), DIALECT 2 query syntax, FT.SEARCH / FT.AGGREGATE / FT.HYBRID command selection, vector similarity with HNSW or FLAT, hybrid retrieval combining lexical and vector ranking, RAG pipelines, zero-downtime index updates via aliases, and debugging with FT.PROFILE and FT.EXPLAIN. Use when defining a search index on Hash or JSON documents, writing FT.SEARCH queries with filters, sorting, aggregation, or vector KNN, tuning HNSW parameters, building a RAG retrieval pipeline, or troubleshooting slow or empty search results.
license: MIT
metadata:
  author: Redis, Inc.
  version: "1.0.0"
---

# Redis Search

Single source of guidance for Redis Search — the retrieval surface that spans lexical, numeric, geo, JSON-path, and vector queries. Vector fields are part of the same `FT.CREATE` machinery as TEXT/TAG/NUMERIC fields, and `FT.HYBRID` blends lexical and vector ranking in one command, so this skill covers them together.

## When to apply

- Creating, modifying, or reviewing a Redis Search index (`FT.CREATE`, `FT.ALTER`).
- Writing or optimizing `FT.SEARCH`, `FT.AGGREGATE`, or `FT.HYBRID` queries.
- Picking between `TEXT`, `TAG`, `NUMERIC`, `GEO`, `GEOSHAPE`, `VECTOR`, or JSON-path fields.
- Defining a `VECTOR` field, choosing HNSW vs FLAT, tuning HNSW parameters.
- Building a retrieval-augmented generation (RAG) pipeline.
- Rolling out a new index schema without downtime.
- Troubleshooting empty results, slow queries, or tokenization issues with `FT.EXPLAIN`, `FT.PROFILE`, `FT.INFO`.

## 1. Pick the right command

Three query commands. Reach for the narrowest one that fits.

| Command | When to use | Mental model | Minimum Redis |
|---|---|---|---|
| **FT.SEARCH** | Document retrieval, ranked or sorted. Best default. | Returns matching docs directly. | 2.0 (module) / 8.0 (built-in) |
| **FT.AGGREGATE** | Faceting, computed fields, custom output shape, analytics. | Declarative pipeline: `LOAD`, `APPLY`, `GROUPBY`, `REDUCE`, `SORTBY`. | 2.0 / 8.0 |
| **FT.HYBRID** | Blend lexical (BM25) with vector similarity, with configurable fusion. | Pipeline with explicit `SEARCH` + `VSIM` legs and a `COMBINE` fusion stage. | **8.4.0** |

```
# FT.SEARCH — most common
FT.SEARCH idx:products "@category:{electronics} @price:[100 500]" LIMIT 0 20 RETURN 3 name price category

# FT.AGGREGATE — top categories by avg price
FT.AGGREGATE idx:products "*" GROUPBY 1 @category REDUCE AVG 1 @price AS avg_price SORTBY 2 @avg_price DESC

# FT.HYBRID (Redis ≥ 8.4) — lexical + vector fusion
FT.HYBRID idx:docs
  SEARCH "@title:transformers" SCORER BM25 YIELD_SCORE_AS lexscore
  VSIM embedding $vec KNN count 1 K 50 YIELD_SCORE_AS vecscore
  COMBINE RRF 2 CONSTANT 60
  PARAMS 2 vec "..."
  DIALECT 2
```

For Redis < 8.4 the lexical+vector blend is approximated with `FT.SEARCH` pre-filter + `=>[KNN ...]`. See [references/command-selection.md](references/command-selection.md) and [references/hybrid-search.md](references/hybrid-search.md).

## 2. Schema basics — `FT.CREATE`

`FT.CREATE` indexes Hash or JSON documents matching a `PREFIX`. Always set `PREFIX`. Use `DIALECT 2` (the default since Redis 8; required for vector queries).

```
FT.CREATE idx:products ON HASH PREFIX 1 product:
    SCHEMA
        name TEXT WEIGHT 2.0
        category TAG SORTABLE
        price NUMERIC SORTABLE
        location GEO
        embedding VECTOR HNSW 6
            TYPE FLOAT32
            DIM 1536
            DISTANCE_METRIC COSINE
```

Pick the narrowest field type that supports your access pattern:

| Field type | Use when | Notes |
|---|---|---|
| `TEXT` | Full-text search | Tokenized + stemmed; **not** for exact match |
| `TAG` | Exact match / filtering | Add `SORTABLE UNF` for fastest tag queries |
| `NUMERIC` | Range queries, sorting | Prices, counts, timestamps |
| `GEO` | Lat/long points | Stores, users |
| `GEOSHAPE` | Polygon / area queries | Delivery zones, regions |
| `VECTOR` | Similarity search | HNSW or FLAT; see §4 |
| JSON `$.path AS alias` | Nested JSON fields | `ON JSON`; see [references/json-indexing.md](references/json-indexing.md) |

The classic mistake is `TEXT` for a category or status field "because it's a string" — `TAG` is roughly 10× faster for exact-match filtering.

See [references/index-creation.md](references/index-creation.md), [references/field-types.md](references/field-types.md), [references/dialect.md](references/dialect.md), [references/ft-create-options.md](references/ft-create-options.md), [references/json-indexing.md](references/json-indexing.md).

## 3. Common queries

Narrow with filters; return only what you need.

```
# Tag filter + numeric range, sorted by price
FT.SEARCH idx:products "@category:{electronics} @price:[100 500]"
    SORTBY price ASC
    LIMIT 0 20
    RETURN 3 name price category

# Text + tag filter
FT.SEARCH idx:products "wireless headphones @category:{audio}"

# Negation and OR
FT.SEARCH idx:products "@category:{audio} -@brand:{generic} (@price:[0 100] | @on_sale:{true})"
```

Operators worth remembering: space = AND, `|` = OR, `-` = NOT, `~` = optional (scoring boost), `=>{$weight: N}` = boost. Escape hyphens and special characters inside TAG values (`@sku:{ABC\\-123}`). See [references/query-syntax.md](references/query-syntax.md) and [references/search-syntax-primitives.md](references/search-syntax-primitives.md) for the DSL vocabulary.

For tokenization gotchas (stemming, stopwords, language) see [references/text-tokenization.md](references/text-tokenization.md). For result shaping (`SORTBY`, `RETURN`, `HIGHLIGHT`, `SUMMARIZE`, `NOCONTENT`) see [references/result-shaping.md](references/result-shaping.md). For performance levers (pre-filters, `SORTABLE` fields, tight `RETURN`, `FT.PROFILE`) see [references/query-optimization.md](references/query-optimization.md).

## 4. Vector basics

Three vector settings have to match the embedding model exactly:

- **`DIM`** — output dimensionality (e.g. 1536 for OpenAI `text-embedding-3-small`). Mismatch produces silent garbage.
- **`DISTANCE_METRIC`** — `COSINE` for normalized text embeddings (common case), `IP` for unnormalized inner-product, `L2` for raw Euclidean.
- **`TYPE`** — usually `FLOAT32`. Use `FLOAT16` or quantized variants only when memory is the binding constraint.

```
# Index
FT.CREATE idx:docs ON HASH PREFIX 1 doc:
    SCHEMA
        content TEXT
        embedding VECTOR HNSW 6 TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE

# Pure KNN query (top 5 by cosine similarity)
FT.SEARCH idx:docs "*=>[KNN 5 @embedding $vec AS score]"
    PARAMS 2 vec "..."
    SORTBY score
    DIALECT 2
```

| Algorithm | Speed | Accuracy | Memory | Use for |
|---|---|---|---|---|
| **HNSW** | Fast (approximate) | ~95%+ recall (tunable) | Higher | Production: >10k vectors, latency-sensitive |
| **FLAT** | Slow (exact) | 100% | Lower | Small corpora (<10k), exact-match required |

HNSW tuning levers: `M` (16–64, connections per node), `EF_CONSTRUCTION` (100–500, build quality), `EF_RUNTIME` (query-time candidate list).

See [references/vector-query.md](references/vector-query.md), [references/algorithm-choice.md](references/algorithm-choice.md).

## 5. Hybrid retrieval

Two distinct patterns get called "hybrid." Pick by intent.

**Filter-then-vector** (any Redis version) — apply attribute filters so the engine narrows the search space *before* the vector comparison.

```
FT.SEARCH idx:docs "(@category:{tech} @date:[2024 +inf])=>[KNN 10 @embedding $vec AS score]"
    PARAMS 2 vec "..."
    SORTBY score
    DIALECT 2
```

**Lexical + vector fusion** (Redis ≥ 8.4) — blend BM25 text scoring with vector similarity, fuse with `RRF` or `LINEAR`. Use `FT.HYBRID` (see §1).

Don't fetch a wide unfiltered result and filter client-side — slower and less accurate. See [references/hybrid-search.md](references/hybrid-search.md).

## 6. Aggregations and shaping

`FT.AGGREGATE` is the declarative result-shaping command. Build a pipeline of stages.

```
# Top 5 categories by total revenue
FT.AGGREGATE idx:orders "@status:{shipped}"
    LOAD 2 @category @amount
    GROUPBY 1 @category
        REDUCE SUM 1 @amount AS revenue
    SORTBY 2 @revenue DESC
    LIMIT 0 5
```

Common stages: `LOAD`, `APPLY` (computed fields), `FILTER` (post-query), `GROUPBY` + `REDUCE` (`SUM`, `COUNT`, `AVG`, `FIRST_VALUE`, `TOLIST`), `SORTBY`, `LIMIT`.

For long-running result sets use `WITHCURSOR` + `FT.CURSOR READ` to page server-side. See [references/aggregate-pipeline.md](references/aggregate-pipeline.md) and [references/aggregate-cursors.md](references/aggregate-cursors.md).

## 7. RAG pattern

Standard pipeline: embed the query, vector-search Redis, pass top-K context to the LLM.

Practical tips:

- **Match the metric** to the embedding model (almost always `COSINE` for normalized text models).
- **Chunk long documents** (200–500-token chunks usually beat indexing whole pages).
- **Batch inserts** rather than one call per record.
- **Pre-filter with attributes** (tenant, recency, document type) before the vector search — see §5.
- **Re-rank** at the top of the funnel if precision matters more than recall.

See [references/rag-pattern.md](references/rag-pattern.md).

## 8. Operations

Zero-downtime schema changes: keep app queries pointed at an alias and swap the underlying index.

```
FT.CREATE idx:products_v2 ON HASH PREFIX 1 product: SCHEMA ...
FT.ALIASUPDATE products idx:products_v2
# App queries are stable:
FT.SEARCH products "@category:{electronics}"
```

Useful management commands: `FT.INFO`, `FT.DROPINDEX`, `FT._LIST`, `FT.ALIASADD/UPDATE/DEL`. See [references/index-management.md](references/index-management.md).

Debug empty or slow queries with `FT.EXPLAIN` (shows how the query was parsed) and `FT.PROFILE` (shows execution stats). See [references/debugging.md](references/debugging.md).

## 9. Client examples

Inline examples in this SKILL.md are CLI / RESP form — the wire protocol every client serializes to. For idiomatic snippets in a specific client:

- **redis-py** (Python, raw client): [references/clients/python-redis-py.md](references/clients/python-redis-py.md)
- **Jedis** (Java): [references/clients/java-jedis.md](references/clients/java-jedis.md)
- **RedisVL** (Python, higher-level SDK on top of redis-py): [references/clients/python-redisvl.md](references/clients/python-redisvl.md)

Other clients (Lettuce, node-redis, go-redis, NRedisStack, .NET) translate the same CLI form; coverage is tracked as a follow-up.

## References

- [Redis: Search and query](https://redis.io/docs/latest/develop/interact/search-and-query/)
- [Redis: Vectors](https://redis.io/docs/latest/develop/ai/search-and-query/vectors/)
- [Redis: Query syntax](https://redis.io/docs/latest/develop/interact/search-and-query/query/)
- [Redis: Query dialects](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/dialects/)
- [Redis: RAG quickstart](https://redis.io/docs/latest/develop/get-started/rag/)
- [FT.CREATE](https://redis.io/docs/latest/commands/ft.create/) · [FT.SEARCH](https://redis.io/docs/latest/commands/ft.search/) · [FT.AGGREGATE](https://redis.io/docs/latest/commands/ft.aggregate/) · [FT.HYBRID](https://redis.io/docs/latest/commands/ft.hybrid/)
- [RedisVL documentation](https://docs.redisvl.com/en/latest/)
