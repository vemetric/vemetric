# Debug Queries with FT.EXPLAIN, FT.PROFILE, FT.INFO

Three commands cover ~95% of search debugging: `FT.EXPLAIN` shows how the parser interpreted the query expression, `FT.PROFILE` measures stage-by-stage execution, and `FT.INFO` reports on the index itself (size, doc count, indexing failures, configuration). Reach for them *before* tweaking schema or rewriting queries.

**Correct:** Run the right diagnostic for the symptom.

```
# Symptom: "my query returns nothing" — see how the parser actually read it
FT.EXPLAIN idx:bicycle "@brand:{Giant-Cycles}"
#  → INTERSECT { @brand:TAG{Giant} NOT TAG{Cycles} }   ← the hyphen was treated as NOT!

# Stemming surprise — see token expansion
FT.EXPLAIN idx:bicycle "running shoes"
#  → INTERSECT { UNION{run, running} UNION{shoe, shoes} }

# Symptom: "slow query" — full stage timing
FT.PROFILE idx:bicycle SEARCH QUERY "@type:{mountain} @price:[100 500]" LIMIT 0 20

# Same for aggregate
FT.PROFILE idx:bicycle AGGREGATE QUERY "@type:{mountain}"
    GROUPBY 1 @brand REDUCE COUNT 0 AS n

# Symptom: "I changed the schema and queries look weird" — inspect the index
FT.INFO idx:bicycle
```

## What to look for in `FT.INFO`

| Field | Means | What to do if it's off |
|-------|-------|------------------------|
| `num_docs` | Indexed doc count. | If lower than expected, check `hash_indexing_failures`. |
| `num_records` | Total indexed terms (across all fields). | High vs `num_docs` may indicate over-indexing TEXT. |
| `hash_indexing_failures` | Documents that failed indexing. | Inspect a failing doc with `JSON.GET` or `HGETALL`; usually a type mismatch on a NUMERIC field, or non-FLOAT32 vector blob. |
| `inverted_sz_mb` | Memory used by the inverted index. | If large, consider `NOOFFSETS`, `NOFREQS`, `NOHL` (see [ft-create-options.md](ft-create-options.md)). |
| `indexing` | `1` if a background indexing job is running. | Wait for `0` before benchmarking. |
| `percent_indexed` | Progress of initial scan. | `1.0` = fully indexed. |
| `gc_stats` | Garbage-collector activity. | Frequent runs usually mean lots of deletes/updates. |
| `attributes` | Per-field schema. | Verify a field is actually present at the alias you're querying. |

## Reading `FT.PROFILE` output

- Top-level `Total profile time` is the wall-clock cost.
- The `Iterators profile` tree shows which query clause did how much work; a giant `Counter` on a TEXT term means it matched a huge fraction of docs.
- `Parsing time` + `Pipeline creation time` + `Iterators profile` should account for ~all the time. If `Iterators profile` is small but `Total` is large, the bottleneck is post-processing (SORT, RETURN, LIMIT).

**Incorrect:** Editing schema or guessing at perf fixes before running diagnostics.

```
# Bad: "let me just add SORTABLE to every field and see what happens"
# Worse: "let me re-create the index" before checking hash_indexing_failures
```

## Common errors and what they mean

| Error | Likely cause |
|-------|--------------|
| `Unknown index name` | Typo, or index dropped. List with `FT._LIST`. |
| `Syntax error at offset N` | Unbalanced `()` / `{}` / `[]`, or unescaped `-`/`.` inside a TAG. |
| `Vector index initialization failed` | DIM mismatch, wrong TYPE, or non-array path. |
| `Document already in index` | Duplicate key on `FT.ADD` (legacy); not produced by modern HSET/JSON.SET flow. |
| `Document is already in index` after `JSON.SET` | Same key indexed by two indexes with overlapping prefixes — narrow the prefixes. |

## Client mirrors

```python
# redis-py — STEP_START debugging
from redis import Redis
r = Redis()
# Parser trace
print(r.ft("idx:bicycle").explain("@brand:{Giant-Cycles}"))
# Timing
print(r.ft("idx:bicycle").profile_search("@type:{mountain}", limit=(0, 20)))
# Index health
info = r.ft("idx:bicycle").info()
print(info["num_docs"], info["hash_indexing_failures"], info["percent_indexed"])
# STEP_END
```

```java
// Jedis — STEP_START debugging
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.Query;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    String explain = jedis.ftExplain("idx:bicycle", new Query("@brand:{Giant-Cycles}"));
    System.out.println(explain);
    System.out.println(jedis.ftProfileSearch("idx:bicycle", null,
        new Query("@type:{mountain}").limit(0, 20)));
    System.out.println(jedis.ftInfo("idx:bicycle"));
}
// STEP_END
```

## Upstream sources

- No direct upstream example — authored from official Redis Search command documentation.
- Reference: [FT.EXPLAIN](https://redis.io/docs/latest/commands/ft.explain/), [FT.PROFILE](https://redis.io/docs/latest/commands/ft.profile/), [FT.INFO](https://redis.io/docs/latest/commands/ft.info/)
