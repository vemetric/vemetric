# Run KNN, Range, and Pre-Filtered Vector Queries

Vector queries live inside `FT.SEARCH` as a `=>[KNN ...]` or `[VECTOR_RANGE ...]` clause. The query *expression* on the left side acts as a pre-filter; the vector clause then runs over the surviving candidate set, not the entire index. Forgetting to pre-filter is the most common cause of slow or low-recall vector queries.

`DIALECT 2` is required for the `=>[KNN ...]` attribute form. The vector blob is bound through `PARAMS` rather than inlined.

**Correct:** KNN, range, and hybrid pre-filter forms against the canonical Bicycle dataset (vector field `description_embeddings`, dim 1536).

```
# Pure KNN — 10 nearest neighbours, no pre-filter
FT.SEARCH idx:bicycle "*=>[KNN 10 @description_embeddings $vec AS score]"
    SORTBY score
    PARAMS 2 vec "<vector_blob>"
    DIALECT 2

# Pre-filtered KNN — narrow by TAG + NUMERIC first, then KNN over survivors
FT.SEARCH idx:bicycle "(@type:{mountain} @price:[100 500])=>[KNN 10 @description_embeddings $vec AS score]"
    SORTBY score
    PARAMS 2 vec "<vector_blob>"
    RETURN 4 model brand price score
    DIALECT 2

# Range query — every doc within radius 0.5 (COSINE distance)
FT.SEARCH idx:bicycle "@description_embeddings:[VECTOR_RANGE 0.5 $vec]=>{$yield_distance_as: dist}"
    SORTBY dist
    PARAMS 2 vec "<vector_blob>"
    DIALECT 2

# Tune recall vs latency per query — HNSW only
FT.SEARCH idx:bicycle "*=>[KNN 10 @description_embeddings $vec EF_RUNTIME 200 AS score]"
    SORTBY score
    PARAMS 2 vec "<vector_blob>"
    DIALECT 2
```

**Why this matters:**

- `AS score` aliases the distance so you can `SORTBY` and `RETURN` it.
- `PARAMS` binds the binary vector blob — never inline it in the query string.
- The pre-filter prefix `(@type:{mountain} @price:[100 500])` is applied *before* the vector search, slashing the work for HNSW.
- `EF_RUNTIME` raises HNSW search effort per-query; the index-time `EF_CONSTRUCTION` is independent.

**Incorrect:** Inlining the vector, omitting `DIALECT 2`, or running a wide-open KNN when you could pre-filter.

```
# Bad: no PARAMS — vector blob does not survive RESP encoding cleanly
FT.SEARCH idx:bicycle "*=>[KNN 10 @description_embeddings <raw-bytes>]" DIALECT 2

# Bad: forgot DIALECT 2 — older default rejects the attribute form
FT.SEARCH idx:bicycle "*=>[KNN 10 @description_embeddings $vec AS score]" PARAMS 2 vec "..."

# Bad: KNN over the whole index when a TAG pre-filter would cut 99% of candidates
FT.SEARCH idx:bicycle "*=>[KNN 10 @description_embeddings $vec AS score]"
    PARAMS 2 vec "..." DIALECT 2
```

**Hybrid lexical + vector ranking with explicit fusion (Redis ≥ 8.4.0):** Use `FT.HYBRID` — see [command-selection.md](command-selection.md). The pre-filter pattern above is still the right tool for *filter-narrowed* vector search; `FT.HYBRID` is for *blended ranking* with RRF or LINEAR fusion.

## Client mirrors

```python
# redis-py — STEP_START vector_query
# Mirrors doctests/search_vss.py + query_combined.py
import numpy as np
from redis import Redis
from redis.commands.search.query import Query

r = Redis()
vec_blob = np.array(query_embedding, dtype=np.float32).tobytes()
q = (
    Query("(@type:{mountain} @price:[100 500])=>[KNN 10 @description_embeddings $vec AS score]")
    .sort_by("score").return_fields("model", "brand", "price", "score")
    .dialect(2).paging(0, 10)
)
results = r.ft("idx:bicycle").search(q, query_params={"vec": vec_blob})
# STEP_END
```

```java
// Jedis — STEP_START vector_query
// Mirrors VectorSearchExample.java
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.Query;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

byte[] vecBlob = floatArrayToBytes(queryEmbedding);  // little-endian FLOAT32
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

## Upstream sources

- redis-py: [`doctests/search_vss.py`](https://github.com/redis/redis-py/blob/master/doctests/search_vss.py), [`query_combined.py`](https://github.com/redis/redis-py/blob/master/doctests/query_combined.py)
- Jedis: [`VectorSearchExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/VectorSearchExample.java)
- Reference: [Vector Search](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/vectors/), [Vector Queries](https://redis.io/docs/latest/develop/interact/search-and-query/query/vector-search/)
