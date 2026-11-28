---
name: redis-clustering
description: Redis Cluster and replication guidance covering hash tags for multi-key operations, avoiding CROSSSLOT errors, and reading from replicas to scale read-heavy workloads. Use when designing keys for a sharded Redis Cluster, debugging CROSSSLOT errors on MGET / SDIFF / pipelines, configuring a multi-key transaction in a cluster, or routing reads to replicas for caches, analytics, or dashboards.
license: MIT
metadata:
  author: Redis, Inc.
  version: "0.1.0"
---

# Redis Clustering

Guidance for designing keys and routing reads in a sharded Redis Cluster (and in standalone primary/replica replication). Covers the two failure modes that bite most new cluster users: `CROSSSLOT` errors on multi-key operations, and overloading primaries with read traffic.

## When to apply

- Designing keys for a Redis Cluster deployment.
- Debugging a `CROSSSLOT` error on `MGET`, `SDIFF`, transactions, or pipelines.
- Implementing transactions / Lua scripts that touch multiple keys.
- Scaling out read traffic without adding shards.

## 1. Hash tags for multi-key operations

Redis Cluster distributes keys across 16,384 slots by hashing the key name. Any command that touches **multiple keys** (`MGET`, `SDIFF`, `SUNIONSTORE`, transactions, pipelines, Lua scripts with multiple `KEYS[]`) requires all keys to live on the **same slot** — otherwise the server returns a `CROSSSLOT` error.

Hash tags force this: the part between `{` and `}` is the only thing hashed for slot assignment, so two keys sharing a hash tag always land together.

```python
# Same slot — multi-key ops work
redis.set("{user:1001}:profile",  "...")
redis.set("{user:1001}:settings", "...")
redis.lmove("{user:1001}:pending", "{user:1001}:processed", "LEFT", "RIGHT")
```

```python
# Different keys, no hash tag — CROSSSLOT on multi-key commands in cluster mode
redis.set("user:1001:profile",  "...")
redis.set("user:1001:settings", "...")
pipe = redis.pipeline()
pipe.get("user:1001:profile")
pipe.get("user:1001:settings")
pipe.execute()  # CROSSSLOT error in cluster
```

Rules of thumb:

- **Use a tag scoped to the meaningful entity**, e.g. `{user:1001}`. Avoid bare `{1001}` — unrelated namespaces (`purchase:{1001}`, `employee:{1001}`) would all collide on the same slot.
- **Only tag where you actually need multi-key ops.** Tagging everything creates hotspots and defeats the point of sharding.
- A single-key command on a hash-tagged key works fine, so adding tags later is incremental — but renaming keys in production is painful, so plan tagging up front for entities you'll group.

See [references/hash-tags.md](references/hash-tags.md).

## 2. Read replicas for read-heavy workloads

If reads dominate writes, route them to replicas to free primary capacity. Works both in Redis Cluster (each shard has 1+ replica) and in standalone primary/replica replication.

```python
# Redis Cluster: enable replica reads on the client
from redis.cluster import RedisCluster

rc = RedisCluster(host="localhost", port=6379, read_from_replicas=True)
rc.set("key", "value")     # → primary
value = rc.get("key")       # → may be served by a replica
```

For non-cluster setups, point two clients at the right nodes:

```python
primary = Redis(host="primary-host", port=6379)
replica = Redis(host="replica-host", port=6379)
primary.set("key", "value")
value = replica.get("key")
```

The trade-off is consistency: **replicas are eventually consistent**. Don't read your own writes from a replica; don't use replica reads for anything that requires strict freshness (financial balances, idempotency state). Good fits: cache layers, analytics, dashboards, recommendation feeds.

See [references/read-replicas.md](references/read-replicas.md).

## References

- [Redis Cluster spec — hash tags](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/#hash-tags)
- [Redis: multi-key operations in cluster](https://redis.io/docs/latest/operate/rs/databases/durability-ha/clustering/#multikey-operations)
- [Redis: Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
