# Paginate Large Aggregations with FT.CURSOR

`FT.AGGREGATE ... LIMIT 0 1000000` materializes the whole result on the server before responding. For large aggregates (millions of groups, long fan-outs), use `WITHCURSOR` and stream batches via `FT.CURSOR READ`. Cursors that aren't read or deleted live until `MAXIDLE` elapses and then are GC'd — explicitly `FT.CURSOR DEL` when you're done.

**Correct:** Open a cursor, drain it in batches, release it.

```
# Open the cursor — COUNT 1000 = up to 1000 rows per batch, MAXIDLE in ms
FT.AGGREGATE idx:bicycle "*"
    GROUPBY 1 @brand
        REDUCE COUNT 0 AS bike_count
    SORTBY 2 @bike_count DESC
    WITHCURSOR COUNT 1000 MAXIDLE 30000
    DIALECT 2
# → reply: { rows..., cursor_id: 12345 }   (cursor_id = 0 means exhausted)

# Pull the next batch
FT.CURSOR READ idx:bicycle 12345 COUNT 1000
# → reply: { rows..., cursor_id: 12345 or 0 }

# Release explicitly when you stop early — don't wait for MAXIDLE
FT.CURSOR DEL idx:bicycle 12345
```

## Cursor lifecycle

- `COUNT n` — max rows per response (the server may return fewer).
- `MAXIDLE ms` — server discards the cursor after this idle time. Default is server-config-dependent (typically 30s).
- A returned `cursor_id` of `0` means the result set is fully drained.
- Cursors are scoped to a specific index; the read/del calls take both `<index>` and `<cursor_id>`.

**Incorrect:** Leaking cursors or trying to paginate aggregates with `LIMIT offset n` for large `n`.

```
# Bad: LIMIT 1000000 5000 — server must compute and skip the first million rows
FT.AGGREGATE idx:bicycle "*" GROUPBY 1 @brand REDUCE COUNT 0 AS n
    SORTBY 2 @n DESC
    LIMIT 1000000 5000
    DIALECT 2

# Bad: Open WITHCURSOR, take first batch, never call FT.CURSOR DEL.
# Cursor leaks until MAXIDLE; long-running ETL jobs accumulate them.
```

## When to use cursors

**Use when:**

- Aggregations expected to return > ~10k rows.
- Streaming results into an ETL/export pipeline.
- Background analytics where you want bounded memory at both ends.

**Skip when:**

- Top-N analytics (`SORTBY ... LIMIT 0 100`) — the result fits in one response.
- Real-time dashboard queries where you only show the top page.

## Client mirrors

```python
# redis-py — STEP_START aggregate_cursor
from redis import Redis
from redis.commands.search.aggregation import AggregateRequest
from redis.commands.search.reducers import count

r = Redis()
req = (AggregateRequest("*")
       .group_by("@brand", count().alias("bike_count"))
       .sort_by(("@bike_count", "DESC"))
       .with_cursor(count=1000, max_idle=30000)
       .dialect(2))
res = r.ft("idx:bicycle").aggregate(req)
# process res.rows ...
while res.cursor and res.cursor.cid:
    res = r.ft("idx:bicycle").aggregate(res.cursor)
    # process res.rows ...
# STEP_END
```

```java
// Jedis — STEP_START aggregate_cursor
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.aggr.AggregationBuilder;
import redis.clients.jedis.search.aggr.AggregationResult;
import redis.clients.jedis.search.aggr.Reducers;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    AggregationBuilder agg = new AggregationBuilder("*")
        .groupBy("@brand", Reducers.count().as("bike_count"))
        .cursor(1000, 30000)
        .dialect(2);
    AggregationResult res = jedis.ftAggregate("idx:bicycle", agg);
    long cursorId = res.getCursorId();
    while (cursorId != 0) {
        res = jedis.ftCursorRead("idx:bicycle", cursorId, 1000);
        cursorId = res.getCursorId();
    }
    // jedis.ftCursorDel("idx:bicycle", cursorId) if exiting early
}
// STEP_END
```

## Upstream sources

- No direct upstream example — authored from official Redis Search command documentation.
- Reference: [FT.AGGREGATE WITHCURSOR](https://redis.io/docs/latest/commands/ft.aggregate/), [FT.CURSOR READ](https://redis.io/docs/latest/commands/ft.cursor-read/), [FT.CURSOR DEL](https://redis.io/docs/latest/commands/ft.cursor-del/)
