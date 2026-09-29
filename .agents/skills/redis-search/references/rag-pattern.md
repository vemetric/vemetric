# Implement RAG Retrieval Against Redis Correctly

A RAG pipeline against Redis is three steps: (1) store documents + embeddings in a HASH or JSON index, (2) embed the user's question with the same model, (3) run a KNN query that returns the top-k passages and their distance. Step 3 is where most quality bugs live — see [vector-query.md](vector-query.md) for the canonical query form.

**Correct: minimal end-to-end pipeline.** The retrieval step is CLI-form first; the embedding/LLM steps are deliberately client-side.

```
# 1. Index, built once
FT.CREATE idx:bicycle ON HASH PREFIX 1 bicycle:
    SCHEMA
        description TEXT
        type TAG
        price NUMERIC SORTABLE
        description_embeddings VECTOR HNSW 6 TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE

# 2. Documents inserted with HSET (or JSON.SET for JSON indexes).
#    The vector field holds the raw FLOAT32 little-endian blob.

# 3. Retrieval — pre-filtered KNN, score aliased, only the fields the LLM needs returned
FT.SEARCH idx:bicycle "(@type:{mountain})=>[KNN 5 @description_embeddings $query_vec AS score]"
    SORTBY score
    PARAMS 2 query_vec "<query_vector_blob>"
    RETURN 3 description type score
    DIALECT 2
```

## End-to-end pattern (redis-py)

```python
# redis-py — STEP_START rag_pipeline
# Distilled from doctests/search_vss.py
import numpy as np
from redis import Redis
from redis.commands.search.query import Query

r = Redis()

def embed(text: str) -> bytes:
    # Replace with your model — must produce the SAME dim as the index (1536 here)
    return np.array(embed_model.encode(text), dtype=np.float32).tobytes()

def retrieve(question: str, k: int = 5, type_filter: str = "mountain"):
    q = (Query(f"(@type:{{{type_filter}}})=>[KNN {k} @description_embeddings $vec AS score]")
         .sort_by("score").return_fields("description", "type", "score")
         .dialect(2).paging(0, k))
    return r.ft("idx:bicycle").search(q, query_params={"vec": embed(question)})

passages = retrieve("lightweight mountain bicycle for trails")
context = "\n\n".join(d.description for d in passages.docs)
# Pass `context` + question to your LLM of choice.
# STEP_END
```

## End-to-end pattern (Jedis)

```java
// Jedis — STEP_START rag_pipeline
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.Query;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    byte[] vec = embed("lightweight mountain bicycle for trails"); // FLOAT32 little-endian
    Query q = new Query("(@type:{mountain})=>[KNN 5 @description_embeddings $vec AS score]")
        .setSortBy("score", true)
        .returnFields("description", "type", "score")
        .addParam("vec", vec)
        .dialect(2)
        .limit(0, 5);
    var result = jedis.ftSearch("idx:bicycle", q);
    // Build the prompt from result.getDocuments() and call your LLM.
}
// STEP_END
```

## Retrieval-quality checklist

- **Match the metric to the model.** Most modern text embedding models pair best with `COSINE`. Normalize embeddings if the model isn't already producing unit vectors and you use `COSINE`.
- **Pre-filter** with TAG/NUMERIC before `=>[KNN ...]` when the user supplies categorical or range constraints — see [vector-query.md](vector-query.md).
- **Return only what the LLM consumes** (the score alias + the passage text). Returning the embedding wastes bandwidth.
- **Chunk long documents** to a size near the embedding model's effective context (e.g., 200–500 tokens) before indexing — retrieval quality drops sharply on chunks too large for the embedding model.
- **Re-embed the corpus** after a model change — you cannot mix embeddings from different models in the same index.
- **Batch inserts** rather than one call per record (e.g., redis-py pipeline or RedisVL `index.load([...])`).

**Incorrect:** Returning everything and filtering client-side, mismatched embedding models, or skipping the pre-filter.

```python
# Bad: client-side filter wastes vector work
results = r.ft("idx:bicycle").search(
    Query("*=>[KNN 1000 @description_embeddings $vec AS score]")
    .sort_by("score").dialect(2),
    query_params={"vec": vec_blob})
mountain = [d for d in results.docs if d.type == "mountain"][:5]

# Bad: question embedded with model A, corpus embedded with model B — distances meaningless
```

## Cross-links

- KNN syntax in depth: [vector-query.md](vector-query.md)
- Vector index configuration: [index-creation.md](index-creation.md)
- Hybrid retrieval (pre-filter vs FT.HYBRID): [hybrid-search.md](hybrid-search.md)

RedisVL `SearchIndex.load()` for bulk doc + embedding insertion and `VectorQuery` end-to-end pipelines live in [clients/python-redisvl.md](clients/python-redisvl.md).

## Upstream sources

- redis-py: [`doctests/search_vss.py`](https://github.com/redis/redis-py/blob/master/doctests/search_vss.py)
- Jedis: [`VectorSearchExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/VectorSearchExample.java)
- Reference: [Redis RAG Quickstart](https://redis.io/docs/latest/develop/get-started/rag/), [Vector Search](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/vectors/)
