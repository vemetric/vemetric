# Combine Lexical and Vector Search Correctly

Two patterns address two different needs:

- **Filter-narrowed vector search** (works on every Redis with vector support): write a normal `FT.SEARCH` with a TAG/NUMERIC pre-filter on the left side of the `=>[KNN ...]` clause. The pre-filter shrinks the candidate set; KNN then runs only over survivors.
- **Blended lexical + vector ranking with explicit fusion** (Redis ≥ 8.4.0): use `FT.HYBRID`, which runs a `SEARCH` leg and a `VSIM` leg in parallel and fuses their rankings via Reciprocal Rank Fusion (`COMBINE RRF`) or a weighted score blend (`COMBINE LINEAR`).

**Correct: pre-filtered KNN** (works on all Redis 8.x and the RediSearch module).

```
# Filter to mountain bikes under $500, then KNN over the survivors
FT.SEARCH idx:bicycle "(@type:{mountain} @price:[100 500])=>[KNN 10 @description_embeddings $vec AS score]"
    SORTBY score
    PARAMS 2 vec "<vector_blob>"
    RETURN 4 model brand price score
    DIALECT 2
```

**Correct: FT.HYBRID** — requires Redis ≥ 8.4.0.

```
# Blend lexical ("mountain bicycle") + vector similarity with RRF fusion
FT.HYBRID idx:bicycle
    SEARCH "mountain bicycle"
    VSIM @description_embeddings $vec
    KNN 2 K 10
    COMBINE RRF 10                         # RRF <count> — number of fused results to keep
    PARAMS 2 vec "<vector_blob>"
    LIMIT 0 10
    DIALECT 2

# Weighted (LINEAR) — α weights the SEARCH score, β the VSIM score
FT.HYBRID idx:bicycle
    SEARCH "mountain bicycle" YIELD_SCORE_AS lex_score
    VSIM @description_embeddings $vec YIELD_SCORE_AS vec_score
    KNN 2 K 20
    COMBINE LINEAR 4 ALPHA 0.4 BETA 0.6
    PARAMS 2 vec "<vector_blob>"
    DIALECT 2
```

## When to use which

| Goal | Use |
|------|-----|
| "Find vectors near $vec, but only within category X and price < $500." | Pre-filtered KNN inside `FT.SEARCH` (works everywhere). |
| "Rank documents by a blend of lexical relevance and semantic similarity." | `FT.HYBRID` (Redis ≥ 8.4.0). |
| "Same goal but on Redis < 8.4.0." | Run two separate queries client-side and fuse the rankings yourself (rough fallback; loses cross-leg score calibration). |

**Incorrect:** Running an unfiltered KNN and then filtering client-side, or assuming `FT.HYBRID` exists on older Redis.

```
# Bad: KNN across the whole index, then filter client-side — burns vector work on rows you'd drop.
FT.SEARCH idx:bicycle "*=>[KNN 1000 @description_embeddings $vec AS score]"
    SORTBY score
    PARAMS 2 vec "<vector_blob>"
    DIALECT 2
# Then in the application: drop any row where type != "mountain" or price not in [100, 500].
```

```python
# Bad (client mirror): same anti-pattern in Python — fetch 1000, filter in memory.
results = r.ft("idx:bicycle").search(
    Query("*=>[KNN 1000 @description_embeddings $vec AS score]")
    .sort_by("score").dialect(2),
    query_params={"vec": vec_blob})
mountain = [r for r in results.docs if r.type == "mountain" and 100 <= int(r.price) <= 500]
```

## Performance notes

- Pre-filter with `TAG` and `NUMERIC` fields — these are cheap and dramatically cut the KNN candidate set.
- For `FT.HYBRID`, the `KNN <count> K <k>` clause inside `VSIM` controls how many vector neighbours feed the fusion stage; the outer `LIMIT` controls how many results you return.
- `COMBINE RRF` needs no tuning; `COMBINE LINEAR` needs calibrated α/β — start at 0.5/0.5 and adjust based on relevance evals.

## Client mirrors

```python
# redis-py — STEP_START hybrid_search
# Mirrors doctests/query_combined.py
import numpy as np
from redis import Redis
from redis.commands.search.query import Query

r = Redis()
vec_blob = np.array(query_embedding, dtype=np.float32).tobytes()
q = (Query("(@type:{mountain} @price:[100 500])=>[KNN 10 @description_embeddings $vec AS score]")
     .sort_by("score").return_fields("model", "brand", "price", "score")
     .dialect(2).paging(0, 10))
r.ft("idx:bicycle").search(q, query_params={"vec": vec_blob})
# STEP_END
```

```java
// Jedis — STEP_START hybrid_search
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.Query;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    Query q = new Query(
        "(@type:{mountain} @price:[100 500])=>[KNN 10 @description_embeddings $vec AS score]")
        .setSortBy("score", true)
        .returnFields("model", "brand", "price", "score")
        .addParam("vec", vecBlob)
        .dialect(2)
        .limit(0, 10);
    jedis.ftSearch("idx:bicycle", q);
}
// STEP_END
```

RedisVL `VectorQuery` with filter expressions and the `HybridQuery` wrapper for `FT.HYBRID` live in [clients/python-redisvl.md](clients/python-redisvl.md).

## Upstream sources

- redis-py: [`doctests/query_combined.py`](https://github.com/redis/redis-py/blob/master/doctests/query_combined.py)
- Jedis: [`VectorSearchExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/VectorSearchExample.java)
- Reference: [Hybrid Queries](https://redis.io/docs/latest/develop/interact/search-and-query/query/combined/), [FT.HYBRID](https://redis.io/docs/latest/commands/ft.hybrid/)
