# Use DIALECT 2 for Query Syntax

Pass `DIALECT 2` on every `FT.SEARCH` / `FT.AGGREGATE` / `FT.HYBRID` call. From Redis 8 onward, **DIALECT 2 is the only supported value** — dialects 1, 3, and 4 are deprecated and removed in current Redis Open Source. Vector query attributes (the `=>[KNN ...]` form) require DIALECT 2 to parse.

**Correct:** Specify DIALECT 2 explicitly, or rely on modern client defaults.

```
# In raw commands, specify DIALECT 2 at the end
FT.SEARCH idx:bicycle "@model:hyperion" DIALECT 2

FT.AGGREGATE idx:bicycle "@type:{mountain}"
    GROUPBY 1 @brand
    REDUCE COUNT 0 AS bike_count
    DIALECT 2
```

**Note on Redis 8 and DIALECT:** Redis 8 (built-in Redis Search) accepts only DIALECT 2. The `DEFAULT_DIALECT` `FT.CONFIG` knob no longer accepts other values. Older Redis 7.x / RediSearch-module deployments still respect dialect 1; if you target both, set `DIALECT 2` explicitly so behavior is identical across versions.

**Why DIALECT 2:**

- Required for vector search (`=>[KNN ...]` attribute syntax).
- Required for `PARAMS` placeholder binding.
- Predictable handling of special characters and NULL-like missing fields.
- The only dialect that will be supported going forward.

**Incorrect:** Relying on the server-side default with a client library that pins an older dialect.

```
# Bad: omitting DIALECT in a vector query with a legacy redis-py — falls back to DIALECT 1 and rejects =>[KNN ...]
FT.SEARCH idx:bicycle "*=>[KNN 10 @embedding $vec AS score]" PARAMS 2 vec "..."
```

## Client mirrors

```python
# redis-py — STEP_START dialect
# Mirrors doctests/search_quickstart.py
from redis import Redis
r = Redis()
# Modern redis-py defaults to DIALECT 2; set explicitly when in doubt
r.ft("idx:bicycle").search("@model:hyperion", dialect=2)
# STEP_END
```

```java
// Jedis — STEP_START dialect
// Mirrors SearchQuickstartExample.java
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.FTSearchParams;
import redis.clients.jedis.search.SearchResult;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    SearchResult res = jedis.ftSearch("idx:bicycle",
        "@model:hyperion",
        FTSearchParams.searchParams().dialect(2));
}
// STEP_END
```

## Upstream sources

- redis-py: [`doctests/search_quickstart.py`](https://github.com/redis/redis-py/blob/master/doctests/search_quickstart.py)
- Jedis: [`SearchQuickstartExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/SearchQuickstartExample.java)
- Reference: [Query Dialects](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/dialects/)
