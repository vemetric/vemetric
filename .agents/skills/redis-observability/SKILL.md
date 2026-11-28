---
name: redis-observability
description: Redis observability guidance — which metrics to monitor (memory, connections, hit ratio, ops/sec, rejected connections), which built-in commands to reach for during incident triage (SLOWLOG, INFO, MEMORY DOCTOR, CLIENT LIST, FT.PROFILE), and when to use the Redis Insight GUI. Use when setting up monitoring or alerts for a Redis instance, diagnosing a performance regression, profiling a slow FT.SEARCH query, or wiring Redis metrics into Prometheus, Datadog, or similar.
license: MIT
metadata:
  author: Redis, Inc.
  version: "0.1.0"
---

# Redis Observability

What to watch, what to run, and what to alert on. Covers the metrics every Redis deployment should monitor and the built-in commands for ad-hoc diagnosis.

## When to apply

- Setting up monitoring or alerts for a Redis instance.
- Diagnosing a Redis performance regression (high latency, memory pressure, connection storms).
- Profiling a slow `FT.SEARCH` or pipeline.
- Wiring Redis metrics into Prometheus, Datadog, CloudWatch, or similar.

## 1. Monitor these metrics

These come from `INFO` and should be exported to your monitoring system.

| Metric | What it tells you | Alert when |
|---|---|---|
| `used_memory` | Current memory usage | > 80% of `maxmemory` |
| `connected_clients` | Open connections | Sudden spikes or drops |
| `blocked_clients` | Clients waiting on blocking ops | > 0 sustained |
| `instantaneous_ops_per_sec` | Current throughput | Significant drops |
| `keyspace_hits` / `keyspace_misses` | Cache hit ratio | Hit ratio < 80% |
| `rejected_connections` | Hit `maxclients` cap | > 0 |
| `rdb_last_save_time` | Last persistence snapshot | Too old vs. RPO |

```python
info = redis.info()
hit_ratio = info["keyspace_hits"] / max(1, info["keyspace_hits"] + info["keyspace_misses"])
print(f"Memory:    {info['used_memory_human']}")
print(f"Clients:   {info['connected_clients']}")
print(f"Ops/sec:   {info['instantaneous_ops_per_sec']}")
print(f"Hit ratio: {hit_ratio:.1%}")
```

See [references/metrics.md](references/metrics.md).

## 2. Built-in commands for debugging

Reach for these when something looks off.

| Topic | Command |
|---|---|
| Slow commands | `SLOWLOG GET 10` / `SLOWLOG LEN` / `SLOWLOG RESET` |
| Server snapshot | `INFO all` (or `INFO memory` / `INFO stats` / `INFO clients` / `INFO replication`) |
| Memory diagnostics | `MEMORY DOCTOR` / `MEMORY STATS` / `MEMORY USAGE <key>` |
| Connections | `CLIENT LIST` / `CLIENT INFO` |
| RQE / Search | `FT.INFO <idx>` / `FT.PROFILE <idx> SEARCH QUERY "..."` |

The two most useful for incident triage:

- **`SLOWLOG GET`** to find queries that exceeded the `slowlog-log-slower-than` threshold (10ms by default). The output shows the exact command and duration in microseconds.
- **`MEMORY DOCTOR`** for memory pressure — it returns a one-paragraph summary of what's unusual about memory usage right now.

```python
for entry in redis.slowlog_get(10):
    print(f"{entry['duration']}μs  {entry['command']}")
```

See [references/commands.md](references/commands.md).

## 3. Redis Insight

For interactive use (running queries, browsing keys, profiling indexes), [Redis Insight](https://redis.io/insight/) is the official GUI. It surfaces the same `SLOWLOG` / `INFO` / `FT.PROFILE` data visually and includes Redis Copilot for natural-language queries. Useful during development and incident response; not a replacement for exporting metrics to your monitoring system.

## References

- [Redis: Latency monitoring](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/)
- [Redis Insight](https://redis.io/insight/)
