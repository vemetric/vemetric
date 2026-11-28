# Manage Indexes for Zero-Downtime Updates

Use index *aliases* so applications query a stable name while you swap the underlying index on schema changes. `FT.ALTER` can append fields to an existing index but cannot change a field's type, options, or remove it — anything beyond *adding* a field requires building a new index and swapping the alias.

**Correct:** Build the new index in parallel, then atomically swap the alias.

```
# 1. Build the new version of the index from scratch
FT.CREATE idx:bicycle_v2 ON HASH PREFIX 1 bicycle:
    SCHEMA
        model TEXT WEIGHT 2.0
        brand TAG
        price NUMERIC SORTABLE

# Wait until percent_indexed = 1.0
FT.INFO idx:bicycle_v2

# 2. Point the application alias at the new index in one atomic step
FT.ALIASUPDATE bicycle idx:bicycle_v2

# 3. Drop the old version
FT.DROPINDEX idx:bicycle_v1
```

**Adding a field is in-place — use `FT.ALTER`:**

```
# Add a TEXT field with WEIGHT to an existing index — no rebuild needed
FT.ALTER idx:bicycle SCHEMA ADD subtitle TEXT WEIGHT 1.5
```

## `FT.ALTER` limitations — when you must rebuild

| Change | Can FT.ALTER do it? |
|--------|---------------------|
| Add a new field | Yes — `FT.ALTER ... SCHEMA ADD ...` |
| Remove a field | **No** — must rebuild. |
| Change a field's type (TEXT → TAG, etc.) | **No** — must rebuild. |
| Change `SORTABLE`, `NOSTEM`, `WEIGHT`, `PHONETIC` | **No** — must rebuild. |
| Change the index `PREFIX` | **No** — must rebuild. |
| Change `LANGUAGE`, `STOPWORDS`, `NOFIELDS`, `NOOFFSETS` | **No** — must rebuild. |
| Grow beyond `MAXTEXTFIELDS` capacity | **No** — must rebuild (set `MAXTEXTFIELDS` upfront on indexes you expect to grow). |

## Useful management commands

```
# List every search index
FT._LIST

# Inspect schema, doc count, indexing progress, memory
FT.INFO idx:bicycle

# Create an alias up front (so application code always uses the alias)
FT.ALIASADD bicycle idx:bicycle_v1

# Atomic swap when a v2 is ready
FT.ALIASUPDATE bicycle idx:bicycle_v2

# Drop an index (non-blocking)
FT.DROPINDEX idx:bicycle_v1

# Drop the index AND delete every indexed document
FT.DROPINDEX idx:bicycle_v1 DD
```

**Incorrect:** Dropping the live index before the new one is ready, or relying on a hard-coded index name in application code.

```
# Bad: drop-and-recreate while traffic is hitting the index
FT.DROPINDEX idx:bicycle
FT.CREATE idx:bicycle ...            # queries during the rebuild return errors

# Bad: application queries idx:bicycle_v1 directly — no painless way to roll forward
```

## Client mirrors

```python
# redis-py — STEP_START index_management
from redis import Redis
r = Redis()
# Build new version, then swap the alias atomically
r.ft("idx:bicycle_v2").create_index(...)
r.ft().aliasupdate("bicycle", "idx:bicycle_v2")
r.ft("idx:bicycle_v1").dropindex(delete_documents=False)
# Add a single field in-place
r.ft("idx:bicycle").alter_schema_add(["subtitle", "TEXT", "WEIGHT", "1.5"])
# STEP_END
```

```java
// Jedis — STEP_START index_management
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.schemafields.TextField;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    // Atomic alias swap
    jedis.ftAliasUpdate("bicycle", "idx:bicycle_v2");
    jedis.ftDropIndex("idx:bicycle_v1");
    // Add a field in place
    jedis.ftAlter("idx:bicycle", TextField.of("subtitle").weight(1.5));
}
// STEP_END
```

## Upstream sources

- redis-py: [`doctests/search_quickstart.py`](https://github.com/redis/redis-py/blob/master/doctests/search_quickstart.py)
- Jedis: [`SearchQuickstartExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/SearchQuickstartExample.java)
- Reference: [FT.ALIASADD / FT.ALIASUPDATE / FT.ALIASDEL](https://redis.io/docs/latest/commands/ft.aliasadd/), [FT.ALTER](https://redis.io/docs/latest/commands/ft.alter/), [FT.DROPINDEX](https://redis.io/docs/latest/commands/ft.dropindex/)
