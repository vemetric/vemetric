# Tune FT.CREATE Options for Memory and Indexing Cost

`FT.CREATE` ships sensible defaults that pay for features most apps want — offsets for highlighting, frequencies for scoring, per-document field map for `FT.AGGREGATE LOAD`. On a very large index, those costs add up. Several flags let you opt out where you don't need them, and a few flags change the *behavior* of index creation itself (`SKIPINITIALSCAN`, `TEMPORARY`).

**Correct:** Pick the flags whose trade-offs match your workload.

```
# A lean index — no highlight, no field-frequency scoring, no field map
FT.CREATE idx:logs ON HASH PREFIX 1 log:
    NOOFFSETS                       # don't store term offsets → no HIGHLIGHT/SUMMARIZE/phrase queries
    NOHL                            # disable highlight payload (subset of NOOFFSETS savings)
    NOFREQS                         # don't store term frequencies → lighter scoring
    NOFIELDS                        # don't store per-doc field bitmap → no @field-scoped queries
    SCHEMA
        message TEXT

# Only index new documents (skip the initial scan over existing keys)
FT.CREATE idx:events ON HASH PREFIX 1 event:
    SKIPINITIALSCAN
    SCHEMA
        topic TAG
        ts NUMERIC SORTABLE

# Pre-allocate room for FT.ALTER (cannot grow beyond MAXTEXTFIELDS slots later)
FT.CREATE idx:bicycle ON HASH PREFIX 1 bicycle:
    MAXTEXTFIELDS                   # reserves capacity for adding TEXT fields later
    SCHEMA
        model TEXT

# Custom stopword list (or disable entirely with STOPWORDS 0)
FT.CREATE idx:books ON HASH PREFIX 1 book:
    STOPWORDS 0                     # disable stopword filtering altogether
    SCHEMA
        title TEXT
        description TEXT

# Auto-expire the index if idle (in seconds) — useful for transient indexes
FT.CREATE idx:session_search ON HASH PREFIX 1 sess:
    TEMPORARY 3600
    SCHEMA
        user_id TAG
        last_query TEXT
```

## Trade-off table

| Flag | Saves | Costs |
|------|-------|-------|
| `NOOFFSETS` | Term offsets — can be 30–50% of TEXT-heavy index size. | Disables `HIGHLIGHT`, `SUMMARIZE`, and phrase queries with `$slop`/`$inorder`. |
| `NOHL` | Highlight payload only. | Disables `HIGHLIGHT` (offsets still kept for phrase queries). |
| `NOFREQS` | Per-term frequency counters. | Scoring quality degrades; BM25 / TFIDF can't differentiate doc relevance well. |
| `NOFIELDS` | Per-document field bitmap. | Disables `@field:` scoping on queries — every term searches all TEXT fields. |
| `SKIPINITIALSCAN` | Time + IO of scanning existing keys. | Existing matching documents are not in the index — only new HSET/JSON.SET. |
| `MAXTEXTFIELDS` | n/a (reserves capacity). | Slightly larger empty-index footprint. Use only if you'll add fields via `FT.ALTER`. |
| `STOPWORDS 0` | Stopword filtering. | Common words (the, and, of) are now searchable and inflate the inverted index. |
| `TEMPORARY <sec>` | n/a (sets a TTL on the index). | Index is reaped after `<sec>` of idleness — must be re-created. |

## `SKIPINITIALSCAN` — when to use it

**Use when:**

- Creating an index for a new feature where existing documents are irrelevant.
- Setting up an index ahead of a data load that will fully populate it.
- The dataset is too large for initial scan latency to be acceptable.
- Event-driven architectures that only care about new events going forward.

**Don't use when:**

- You need historical documents to appear in search immediately.
- Migrating an existing dataset to a new schema (the new index must include all existing docs).
- Most general-purpose search use cases.

The default behavior (without `SKIPINITIALSCAN`) indexes all existing matching keys, which is usually what you want.

**Incorrect:** Disabling features you actually use, or combining mutually destructive flags.

```
# Bad: NOOFFSETS on an index that highlights snippets in the UI.
FT.CREATE idx:blog ON HASH PREFIX 1 post:
    NOOFFSETS
    SCHEMA title TEXT body TEXT
# Later — fails or returns no highlights:
FT.SEARCH idx:blog "redis" HIGHLIGHT FIELDS 1 body

# Bad: NOFIELDS with field-scoped queries — every @-prefixed term becomes a global term
FT.CREATE idx:logs ON HASH PREFIX 1 log: NOFIELDS SCHEMA service TAG message TEXT
FT.SEARCH idx:logs "@service:{api}"     # no longer effective

# Bad: SKIPINITIALSCAN when migrating data into a new index
FT.CREATE idx:v2 ON HASH PREFIX 1 product: SKIPINITIALSCAN SCHEMA name TEXT
# Existing product:* keys are never indexed; queries return only new docs.
```

## Client mirrors

```python
# redis-py — STEP_START ft_create_options
from redis import Redis
from redis.commands.search.field import TextField, TagField, NumericField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType

r = Redis()
# SKIPINITIALSCAN — only new events get indexed
r.ft("idx:events").create_index(
    (TagField("topic"), NumericField("ts", sortable=True)),
    definition=IndexDefinition(prefix=["event:"], index_type=IndexType.HASH),
    skip_initial_scan=True,
)
# Lean log index
r.ft("idx:logs").create_index(
    (TextField("message"),),
    definition=IndexDefinition(prefix=["log:"], index_type=IndexType.HASH),
    no_term_offsets=True, no_field_flags=True, no_term_frequencies=True,
)
# STEP_END
```

```java
// Jedis — STEP_START ft_create_options
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.FTCreateParams;
import redis.clients.jedis.search.IndexDataType;
import redis.clients.jedis.search.schemafields.*;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    jedis.ftCreate("idx:events",
        FTCreateParams.createParams().on(IndexDataType.HASH).prefix("event:").skipInitialScan(),
        TagField.of("topic"), NumericField.of("ts").sortable());

    jedis.ftCreate("idx:logs",
        FTCreateParams.createParams().on(IndexDataType.HASH).prefix("log:")
            .noOffsets().noFields().noFrequencies(),
        TextField.of("message"));
}
// STEP_END
```

## Upstream sources

- redis-py: [`doctests/search_quickstart.py`](https://github.com/redis/redis-py/blob/master/doctests/search_quickstart.py)
- Jedis: [`SearchQuickstartExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/SearchQuickstartExample.java)
- Reference: [FT.CREATE](https://redis.io/docs/latest/commands/ft.create/)
