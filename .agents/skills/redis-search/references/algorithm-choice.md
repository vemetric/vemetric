# Choose HNSW vs FLAT Based on Requirements

`HNSW` (Hierarchical Navigable Small World) is the production default: approximate nearest neighbour with tunable recall, sub-millisecond queries even on millions of vectors. `FLAT` is exact brute-force: 100% recall but linear scan cost — fine for thousands of vectors, not for millions.

| Algorithm | Speed | Accuracy | Memory | Best for |
|-----------|-------|----------|--------|----------|
| HNSW | Fast (approximate) | ~95%+ recall, tunable | Higher | Large datasets (> 10k vectors) |
| FLAT | Slow (exact) | 100% (exact) | Lower | Small datasets, accuracy-critical |

**Correct: HNSW** — use for large-scale production workloads.

```
# HNSW with tunable M and EF_CONSTRUCTION
FT.CREATE idx:bicycle ON HASH PREFIX 1 bicycle:
    SCHEMA
        description_embeddings VECTOR HNSW 10
            TYPE FLOAT32
            DIM 1536
            DISTANCE_METRIC COSINE
            M 16
            EF_CONSTRUCTION 200
```

**Correct: FLAT** — use when exact results are required and the dataset is small.

```
# FLAT — exact brute-force search, guaranteed accuracy
FT.CREATE idx:bicycle_small ON HASH PREFIX 1 bicycle_small:
    SCHEMA
        description_embeddings VECTOR FLAT 6
            TYPE FLOAT32
            DIM 1536
            DISTANCE_METRIC COSINE
```

## Tuning HNSW recall vs latency

- `M` (default 16) — graph connections per node. Higher = better recall, more memory. Practical range 8–64.
- `EF_CONSTRUCTION` (default 200) — build-time exploration depth. Higher = better graph quality, slower index build.
- `EF_RUNTIME` — per-query exploration depth. Set on the query itself (`...=>[KNN 10 @vec $vec EF_RUNTIME 200 AS score]`), not at index time. Higher = better recall, slower query.

## When to use FLAT

- Dataset under ~10k vectors and won't grow much.
- Recall must be exactly 100% (e.g., regulatory or evaluation/baseline use cases).
- You need predictable, deterministic results regardless of insert order.

## When to use HNSW

- Production semantic search, RAG retrieval, recommendation.
- Datasets above ~10k vectors where linear scan becomes expensive.
- Any case where 95%+ recall is acceptable.

**Incorrect:** FLAT on a million-vector index, or under-tuning HNSW and then blaming recall.

```
# Bad: FLAT on 1M vectors — every query becomes a 1M-vector linear scan
FT.CREATE idx:big_vectors ON HASH PREFIX 1 doc:
    SCHEMA embedding VECTOR FLAT 6 TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE

# Bad: HNSW with default M=16 and EF_CONSTRUCTION=200 on a recall-critical workload —
# then logging poor recall instead of raising EF_RUNTIME at query time.
```

## Client mirrors

```python
# redis-py — STEP_START vector_algorithm
from redis import Redis
from redis.commands.search.field import VectorField
r = Redis()
hnsw = VectorField("description_embeddings", algorithm="HNSW",
    attributes={"TYPE": "FLOAT32", "DIM": 1536, "DISTANCE_METRIC": "COSINE",
                "M": 16, "EF_CONSTRUCTION": 200})
flat = VectorField("description_embeddings", algorithm="FLAT",
    attributes={"TYPE": "FLOAT32", "DIM": 1536, "DISTANCE_METRIC": "COSINE"})
# STEP_END
```

```java
// Jedis — STEP_START vector_algorithm
import redis.clients.jedis.search.schemafields.VectorField;
import java.util.Map;
VectorField hnsw = VectorField.builder()
    .fieldName("description_embeddings")
    .algorithm(VectorField.VectorAlgorithm.HNSW)
    .attributes(Map.of("TYPE", "FLOAT32", "DIM", 1536,
                       "DISTANCE_METRIC", "COSINE",
                       "M", 16, "EF_CONSTRUCTION", 200))
    .build();
VectorField flat = VectorField.builder()
    .fieldName("description_embeddings")
    .algorithm(VectorField.VectorAlgorithm.FLAT)
    .attributes(Map.of("TYPE", "FLOAT32", "DIM", 1536, "DISTANCE_METRIC", "COSINE"))
    .build();
// STEP_END
```

RedisVL schema-dict examples for HNSW and FLAT live in [clients/python-redisvl.md](clients/python-redisvl.md).

## Upstream sources

- Reference: [Vector Reference](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/vectors/)
