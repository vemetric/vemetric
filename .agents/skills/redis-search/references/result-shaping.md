# Shape Search Results with RETURN, SORTBY, HIGHLIGHT, SUMMARIZE

By default `FT.SEARCH` returns full documents — expensive when you only need a few fields, or a count, or a UI-ready snippet. The result-shaping clauses (`RETURN`, `NOCONTENT`, `LIMIT`, `SORTBY`, `HIGHLIGHT`, `SUMMARIZE`) trim the response server-side and pre-format text for display.

**Correct:** Shape the response to exactly what the caller needs.

```
# Count only — no documents returned
FT.SEARCH idx:bicycle "@type:{mountain}" LIMIT 0 0 DIALECT 2

# IDs only — NOCONTENT skips the field payload
FT.SEARCH idx:bicycle "@type:{mountain}" NOCONTENT LIMIT 0 20 DIALECT 2

# Specific fields only — RETURN n field1 field2 ...
FT.SEARCH idx:bicycle "@type:{mountain}"
    RETURN 3 model brand price
    LIMIT 0 20
    DIALECT 2

# Sort by an indexed field — requires SORTABLE on the field at FT.CREATE time
FT.SEARCH idx:bicycle "@type:{mountain}"
    SORTBY price ASC
    LIMIT 0 10
    RETURN 3 model brand price
    DIALECT 2

# Highlight matched terms with HTML tags
FT.SEARCH idx:bicycle "wireless"
    HIGHLIGHT FIELDS 1 description TAGS "<b>" "</b>"
    DIALECT 2

# Summarize: extract up to 3 fragments of 20 tokens each from @description
FT.SEARCH idx:bicycle "wireless"
    SUMMARIZE FIELDS 1 description FRAGS 3 LEN 20 SEPARATOR " ... "
    DIALECT 2
```

## RETURN counts tokens, not fields

`nargs = 3·(aliased paths) + 1·(unaliased paths)`. `RETURN <nargs> <args>` consumes exactly `<nargs>` whitespace-separated tokens. A plain field is 1 token; an aliased JSONPath (`<path> AS <alias>`) is 3 tokens. Setting `nargs` to the number of *fields* you want back is the most common single bug in real LLM-generated `FT.SEARCH` calls.

```
# Bad: nargs counted as paths — "Unknown argument 'AS' at position 4"
FT.SEARCH idx:breweries "*" RETURN 1 $.beers[*].name AS beer_names

# Bad: two aliased paths but nargs=2 — "RETURN path AS name - must be accompanied with NAME"
FT.SEARCH idx:breweries "*" RETURN 2 $.status AS status $.reason AS reason

# Good: no alias, 1 token per path
FT.SEARCH idx:breweries "*" RETURN 1 $.beers[*].name

# Good: one aliased path = 3 tokens (path + AS + alias)
FT.SEARCH idx:breweries "*" RETURN 3 $.beers[*].name AS beer_names

# Good: two aliased paths = 6 tokens
FT.SEARCH idx:breweries "*" RETURN 6 $.status AS status $.reason AS reason

# Good: mixed — 1 unaliased + 1 aliased = 1 + 3 = 4 tokens
FT.SEARCH idx:breweries "*" RETURN 4 $.id $.status AS status
```

## Why these matter

- `RETURN n` is the single biggest perf win for wide schemas — typical 50% latency cut when you stop sending unused fields.
- `SORTBY` on a non-`SORTABLE` field falls back to a row-by-row sort over the result page; on a `SORTABLE NUMERIC` field it's near-free.
- `NOCONTENT` is what `FT.SEARCH` wants when you only need the matching keys (e.g., to pipeline a follow-up `MGET`).
- `LIMIT 0 0` is the canonical count idiom — total appears in position 0 of the reply.
- `HIGHLIGHT` and `SUMMARIZE` only operate on TEXT fields and assume the field was indexed without `NOOFFSETS`.

## FT.SEARCH `SORTBY` has NO nargs

The form is `SORTBY <field> [ASC|DESC]`. This is different from `FT.AGGREGATE`'s `SORTBY <nargs> <field> <DIR> …`. Mixing them produces `Unknown argument 'author' at position 3`-style errors.

```
# Bad: applying the FT.AGGREGATE token-count form inside FT.SEARCH
FT.SEARCH idx:doc "*" SORTBY 2 author ASC      # "Unknown argument 'author' at position 3"

# Good: plain field + direction
FT.SEARCH idx:doc "*" SORTBY author ASC
```

**Incorrect:** Pagination with deep offsets, sorting non-SORTABLE fields at high LIMIT, fetching full docs to throw away most fields.

```
# Bad: deep pagination — server must scan + sort offset+page rows
FT.SEARCH idx:bicycle "*" LIMIT 100000 20

# Bad: SORTBY a TEXT field that wasn't marked SORTABLE — falls back to in-page sort
FT.SEARCH idx:bicycle "*" SORTBY description ASC LIMIT 0 1000

# Bad: fetching the entire doc when only 3 fields are used in the UI
FT.SEARCH idx:bicycle "*" LIMIT 0 50
```

## Pagination patterns

- Up to a few thousand rows: `LIMIT offset n` is fine.
- Beyond that, switch to **search-after** patterns (sort by a stable cursor like `@id` or `@created_at`, then `FILTER @id > $last` on the next page).
- For `FT.AGGREGATE` over very large result sets, use `WITHCURSOR` (see [aggregate-cursors.md](aggregate-cursors.md)).

## Client mirrors

```python
# redis-py — STEP_START result_shaping
from redis import Redis
from redis.commands.search.query import Query

r = Redis()
q = (Query("@type:{mountain}")
     .return_fields("model", "brand", "price")
     .sort_by("price", asc=True)
     .paging(0, 20)
     .dialect(2))
results = r.ft("idx:bicycle").search(q)
# Count-only
total = r.ft("idx:bicycle").search(Query("@type:{mountain}").paging(0, 0).dialect(2)).total
# STEP_END
```

```java
// Jedis — STEP_START result_shaping
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.Query;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    Query q = new Query("@type:{mountain}")
        .returnFields("model", "brand", "price")
        .setSortBy("price", true)
        .limit(0, 20)
        .dialect(2);
    jedis.ftSearch("idx:bicycle", q);

    Query countOnly = new Query("@type:{mountain}").limit(0, 0).dialect(2);
    long total = jedis.ftSearch("idx:bicycle", countOnly).getTotalResults();
}
// STEP_END
```

## Upstream sources

- redis-py: covered across the upstream `doctests/query_*.py` set, including [`doctests/query_ft.py`](https://github.com/redis/redis-py/blob/master/doctests/query_ft.py)
- Jedis: covered across the upstream `Query*Example.java` set, including [`QueryFtExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/QueryFtExample.java)
- Reference: [FT.SEARCH](https://redis.io/docs/latest/commands/ft.search/), [Highlighting](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/highlight/)
