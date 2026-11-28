# Index Only Fields You Query

Create indexes with only the fields you need to search, filter, or sort on. Every indexed field costs memory on every write, even if no query ever touches it. Always set a `PREFIX` so `FT.CREATE` doesn't try to index every key in the database.

**Correct:** Index specific fields and constrain by prefix (Bicycle dataset, HASH).

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

For JSON documents, see [json-indexing.md](json-indexing.md) — the same principles apply, but paths use the `$.path AS alias` form. For FT.CREATE flag options (`SKIPINITIALSCAN`, `NOOFFSETS`, `NOFIELDS`, etc.) and their memory trade-offs, see [ft-create-options.md](ft-create-options.md).

## Vector fields

A vector field needs three things stated correctly at index time: `TYPE` (almost always `FLOAT32`), `DIM` (must equal your embedding model's output size), and `DISTANCE_METRIC` (`COSINE`, `L2`, or `IP`). Mismatching any of these silently produces wrong results or refuses inserts — there is no runtime warning.

For the algorithm choice (HNSW vs FLAT) and tuning, see [algorithm-choice.md](algorithm-choice.md).

```
# Canonical HASH index with text fields + a vector field (1536-dim OpenAI-style embeddings)
FT.CREATE idx:bicycle ON HASH PREFIX 1 bicycle:
    SCHEMA
        model         TEXT WEIGHT 2.0
        brand         TAG
        description   TEXT
        condition     TAG
        price         NUMERIC SORTABLE
        description_embeddings VECTOR HNSW 6
            TYPE FLOAT32
            DIM 1536
            DISTANCE_METRIC COSINE
```

**JSON variant** — JSONPath plus `AS alias` (see [json-indexing.md](json-indexing.md)):

```
FT.CREATE idx:bicycle ON JSON PREFIX 1 bicycle:
    SCHEMA
        $.description_embeddings AS description_embeddings VECTOR HNSW 6
            TYPE FLOAT32
            DIM 1536
            DISTANCE_METRIC COSINE
```

### Required vector attributes

| Attribute | Values | Notes |
|-----------|--------|-------|
| `TYPE` | `FLOAT32`, `FLOAT64`, `BFLOAT16`, `FLOAT16` | `FLOAT32` is the standard. Lower-precision types save memory on very large indexes. |
| `DIM` | integer | Must match the embedding model exactly — 1536 for OpenAI `text-embedding-3-small` / `ada-002`, 3072 for `text-embedding-3-large`, 768 for many open-source models. |
| `DISTANCE_METRIC` | `COSINE`, `L2`, `IP` | Match the metric your embedding model was trained for. Normalized embeddings work with all three but `COSINE` is the typical choice. |

**Verifying the index after creation:**

```
FT.INFO idx:bicycle
# Look for "attributes" — confirm vector field shows correct DIM/TYPE/DISTANCE_METRIC.
# Check num_docs vs source key count, and hash_indexing_failures.
```

**Incorrect:** Over-indexing every field "just in case," creating an index without a prefix, DIM mismatch on vectors, or inlining the vector blob in the query (use `PARAMS` — see [vector-query.md](vector-query.md)).

```
# Bad: every field indexed, regardless of whether queries use it
FT.CREATE idx:bicycle ON HASH PREFIX 1 bicycle:
    SCHEMA
        model TEXT description TEXT brand TEXT subcategory TEXT
        sku TEXT cost NUMERIC margin NUMERIC supplier_id TAG ...

# Bad: no prefix — every hash in the database gets indexed
FT.CREATE idx:everything ON HASH SCHEMA model TEXT

# Bad: DIM mismatch — inserts silently truncated/padded, queries return junk
FT.CREATE idx:bicycle ON HASH PREFIX 1 bicycle:
    SCHEMA description_embeddings VECTOR HNSW 6 TYPE FLOAT32 DIM 768 DISTANCE_METRIC COSINE
# ... but the embeddings inserted are 1536 floats

# Bad: L2 on normalized embeddings — works but obscures interpretability (use COSINE)
```

## Tips

- Start with the minimum required fields; add via `FT.ALTER` (subject to `MAXTEXTFIELDS` capacity) as new query patterns emerge.
- Use `FT.INFO` to monitor `inverted_sz_mb` and `num_records`.
- Always specify a prefix to avoid indexing unrelated keys.
- Consider field-type alternatives: TAG beats TEXT for exact-match filters; SORTABLE on NUMERIC fields you'll use in `SORTBY`.

## Client mirrors

```python
# redis-py — STEP_START create_index
# Mirrors doctests/search_quickstart.py + search_vss.py
from redis import Redis
from redis.commands.search.field import TextField, TagField, NumericField, GeoField, VectorField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType

r = Redis()
schema = (
    TextField("model", weight=2.0),
    TextField("description"),
    TagField("brand"),
    TagField("condition"),
    NumericField("price", sortable=True),
    GeoField("store_location"),
    VectorField("description_embeddings",
                algorithm="HNSW",
                attributes={"TYPE": "FLOAT32", "DIM": 1536, "DISTANCE_METRIC": "COSINE"}),
)
r.ft("idx:bicycle").create_index(
    schema,
    definition=IndexDefinition(prefix=["bicycle:"], index_type=IndexType.HASH))
# STEP_END
```

```java
// Jedis — STEP_START create_index
// Mirrors SearchQuickstartExample.java + VectorSearchExample.java
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.FTCreateParams;
import redis.clients.jedis.search.IndexDataType;
import redis.clients.jedis.search.schemafields.*;
import java.util.Map;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    jedis.ftCreate("idx:bicycle",
        FTCreateParams.createParams().on(IndexDataType.HASH).prefix("bicycle:"),
        TextField.of("model").weight(2.0),
        TextField.of("description"),
        TagField.of("brand"),
        TagField.of("condition"),
        NumericField.of("price").sortable(),
        GeoField.of("store_location"),
        VectorField.builder()
            .fieldName("description_embeddings")
            .algorithm(VectorField.VectorAlgorithm.HNSW)
            .attributes(Map.of("TYPE", "FLOAT32", "DIM", 1536, "DISTANCE_METRIC", "COSINE"))
            .build());
}
// STEP_END
```

RedisVL higher-level schema-from-dict and `SearchIndex` usage are covered in [clients/python-redisvl.md](clients/python-redisvl.md).

## Upstream sources

- redis-py: [`doctests/search_quickstart.py`](https://github.com/redis/redis-py/blob/master/doctests/search_quickstart.py), [`doctests/search_vss.py`](https://github.com/redis/redis-py/blob/master/doctests/search_vss.py)
- Jedis: [`SearchQuickstartExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/SearchQuickstartExample.java), [`VectorSearchExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/VectorSearchExample.java)
- Reference: [FT.CREATE](https://redis.io/docs/latest/commands/ft.create/), [Indexing](https://redis.io/docs/latest/develop/interact/search-and-query/indexing/), [Vector Reference](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/vectors/)
