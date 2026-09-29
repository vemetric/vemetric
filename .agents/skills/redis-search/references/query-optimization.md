# Write Performant Queries

This reference is performance-focused — syntax details live in [query-syntax.md](query-syntax.md), vector queries in [vector-query.md](vector-query.md), aggregate pipelines in [aggregate-pipeline.md](aggregate-pipeline.md). The lever is the same in every case: narrow the candidate set as early as possible, return as little as possible, and use indexed sort paths.

**Correct:** Pre-filter, sort on `SORTABLE` fields, return only what you use.

```
# Specific filters drop the candidate set before any scoring
FT.SEARCH idx:bicycle "@type:{mountain} @price:[100 500]"
    SORTBY price ASC                       # price is SORTABLE NUMERIC → near-free
    LIMIT 0 20
    RETURN 3 model brand price
    DIALECT 2

# Pre-filtered vector query — TAG + NUMERIC cut 99% of vectors before KNN
FT.SEARCH idx:bicycle "(@type:{mountain} @price:[100 500])=>[KNN 10 @description_embeddings $vec AS score]"
    SORTBY score
    PARAMS 2 vec "<vector_blob>"
    RETURN 4 model brand price score
    DIALECT 2
```

## The performance levers — in priority order

1. **Narrow with TAG / NUMERIC predicates first.** They're cheaper than TEXT scoring and cut candidate counts dramatically. See [query-syntax.md](query-syntax.md).
2. **`SORTBY` on `SORTABLE` fields.** Non-sortable sorting falls back to a row-by-row sort over the page. Mark `NUMERIC SORTABLE` and `TAG SORTABLE` on any field you'll order by.
3. **`LIMIT 0 n` aggressively.** Default page size returns 10; raising to 1000 is fine, raising to 100000 will hurt.
4. **`RETURN n f1 f2 ...`** stops Redis from materializing fields you'll throw away. Combine with `NOCONTENT` when you only need keys.
5. **`NOSTEM` and `TAG` over `TEXT` for identifiers.** Tokenization is expensive and easy to misconfigure (see [text-tokenization.md](text-tokenization.md)).
6. **Profile, don't guess.** `FT.PROFILE` reports per-stage timing; `FT.EXPLAIN` shows how the parser interpreted the query (see [debugging.md](debugging.md)).

```
# Diagnose a slow query
FT.PROFILE idx:bicycle SEARCH QUERY "@type:{mountain}" LIMIT 0 20

# See whether stemming/expansion is bloating the term list
FT.EXPLAIN idx:bicycle "running shoes"
```

**Incorrect:** Wildcard scans, deep pagination, sorting non-SORTABLE fields, dumping the full doc.

```
# Bad: wildcard scan over the whole index
FT.SEARCH idx:bicycle "*" LIMIT 0 10000

# Bad: deep offset pagination — server scans+sorts offset+page rows
FT.SEARCH idx:bicycle "*" LIMIT 100000 20

# Bad: SORTBY on a non-SORTABLE TEXT field at high LIMIT
FT.SEARCH idx:bicycle "*" SORTBY description ASC LIMIT 0 1000

# Bad: returning every field when only 3 are used downstream
FT.AGGREGATE idx:bicycle "*" LOAD *
```

## Client mirrors

```python
# redis-py — STEP_START query_perf
from redis import Redis
from redis.commands.search.query import Query
r = Redis()
q = (Query("@type:{mountain} @price:[100 500]")
     .sort_by("price", asc=True)
     .return_fields("model", "brand", "price")
     .paging(0, 20)
     .dialect(2))
r.ft("idx:bicycle").search(q)
# STEP_END
```

```java
// Jedis — STEP_START query_perf
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.Query;
try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    Query q = new Query("@type:{mountain} @price:[100 500]")
        .setSortBy("price", true)
        .returnFields("model", "brand", "price")
        .limit(0, 20)
        .dialect(2);
    jedis.ftSearch("idx:bicycle", q);
}
// STEP_END
```

## Upstream sources

- redis-py: [`doctests/search_quickstart.py`](https://github.com/redis/redis-py/blob/master/doctests/search_quickstart.py)
- Jedis: [`SearchQuickstartExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/SearchQuickstartExample.java)
- Reference: [Query Syntax](https://redis.io/docs/latest/develop/interact/search-and-query/query/), [FT.PROFILE](https://redis.io/docs/latest/commands/ft.profile/)
