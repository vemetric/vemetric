---
name: redis-connections
description: Redis client and connection guidance covering connection pooling, multiplexing, pipelining, client-side caching with RESP3, avoiding slow commands (KEYS, SMEMBERS, HGETALL), and tuning socket timeouts. Use when configuring a Redis client (redis-py, Jedis, Lettuce, NRedisStack), batching commands for throughput, eliminating per-request connection creation, iterating large keyspaces with SCAN, enabling client-side caching for read-heavy workloads, or setting connect and read timeouts.
license: MIT
metadata:
  author: Redis, Inc.
  version: "0.1.0"
---

# Redis Connections

Client-side guidance for talking to Redis efficiently: how to share connections, how to batch commands, which commands not to call in production, when to turn on client-side caching, and how to set timeouts that fail fast without breaking healthy traffic.

## When to apply

- Creating or reviewing a Redis client setup (redis-py, Jedis, Lettuce, go-redis, NRedisStack).
- Making many small Redis calls and wondering where the latency is going.
- Iterating large keyspaces, sets, hashes, or lists.
- Enabling client-side caching for hot keys.
- Tuning connect / read / write timeouts.

## 1. Pool or multiplex — never one connection per request

The single biggest mistake in Redis client code is opening a new TCP connection for every operation. Always either:

- **Pool** — keep N persistent connections that the application leases per call (redis-py `ConnectionPool`, Jedis `JedisPooled`, go-redis client).
- **Multiplex** — share a single connection across all requests (Lettuce, NRedisStack).

| Style | Used by | Note |
|---|---|---|
| Pool | redis-py, Jedis, go-redis | Each lease blocks if pool exhausted; size the pool to your concurrency |
| Multiplex | Lettuce, NRedisStack | Single connection; **cannot** carry blocking commands like `BLPOP` |

```python
# redis-py — connection pool
pool = redis.ConnectionPool(host="localhost", port=6379, max_connections=50)
r = redis.Redis(connection_pool=pool)
```

See [references/pooling.md](references/pooling.md) for Python + Java + Lettuce examples.

## 2. Pipeline bulk work

For N commands that don't depend on each other's results, send them as a single batch with pipelining. One round-trip instead of N.

```python
pipe = redis.pipeline()
for user_id in user_ids:
    pipe.get(f"user:{user_id}")
results = pipe.execute()
```

Use **non-transactional** pipelining for performance, and `pipeline(transaction=True)` only when you actually need atomicity (see redis-core's transactions guidance).

See [references/pipelining.md](references/pipelining.md).

## 3. Avoid commands that scan everything

Anything that walks the whole keyspace (or a whole large container) blocks the server. Use incremental variants instead.

| Don't | Use |
|---|---|
| `KEYS pattern` | `SCAN` cursor loop |
| `SMEMBERS large_set` | `SSCAN` |
| `HGETALL large_hash` | `HSCAN` |
| `LRANGE 0 -1` on a huge list | Paginate (`LRANGE 0 100`) |

```python
cursor = 0
while True:
    cursor, keys = redis.scan(cursor, match="user:*", count=100)
    for key in keys:
        process(key)
    if cursor == 0:
        break
```

**Blocking commands (`BLPOP`, `BRPOP`, `BLMOVE`) are different** — they intentionally wait for data and are fine for queue consumers, but always pass a timeout, and don't issue them on a multiplexed connection (Lettuce, NRedisStack).

See [references/blocking.md](references/blocking.md).

## 4. Client-side caching for hot keys

For data that's read often and written rarely (config, feature flags, sessions on every request), enable RESP3 client-side caching. The client keeps a local copy and the server invalidates it on writes — saving the round trip for hot reads.

```python
client = redis.Redis(
    host="localhost",
    port=6379,
    protocol=3,                                    # RESP3 is required
    cache_config=redis.CacheConfig(max_size=1000),
)
```

Skip it for write-heavy workloads or data that changes constantly — the invalidation traffic overruns the savings.

See [references/client-cache.md](references/client-cache.md).

## 5. Set explicit timeouts

Defaults vary by client and may be too generous. Pick values that match the *application's* failure model:

```python
r = redis.Redis(
    host="localhost",
    socket_connect_timeout=2.0,   # fail fast on dead nodes
    socket_timeout=5.0,           # tune to expected operation time
    retry_on_timeout=True,
)
```

Rule of thumb: connect timeout shorter than read/write timeout. Tight timeouts + retry-on-timeout for latency-sensitive paths; longer timeouts for batch jobs.

See [references/timeouts.md](references/timeouts.md).

## References

- [Redis: Connection Pools and Multiplexing](https://redis.io/docs/latest/develop/clients/pools-and-muxing/)
- [Redis: Pipelining](https://redis.io/docs/latest/develop/use/pipelining/)
- [Redis: SCAN](https://redis.io/docs/latest/commands/scan/)
- [Redis: Client-side caching](https://redis.io/docs/latest/develop/clients/client-side-caching/)
- [Redis: Clients](https://redis.io/docs/latest/develop/clients/)
