# Ingestion tools

Tools to check ingestion changes before they reach production:

- **`compare`** runs one fixed traffic scenario through two code versions and diffs the resulting analytics data (sessions, devices, users, events, dashboard queries). Use it to confirm that a change produces the same results.
- **`loadtest`** starts a hub and N worker processes locally, sends traffic over HTTP at a fixed rate and reports throughput, backlog, Redis memory and whether all sent data was stored. Use it to find where a version saturates.
- **`benchmark`** generates legacy data at a chosen scale, migrates it with the real backfill and runs the dashboard queries of two versions against it. Use it to catch slower or more memory-hungry queries.
- **`prod-check`** reads settings, versions and anonymized sizes from production, read-only. Its output sizes the benchmark and checks the rollout prerequisites.
- **`rehearsal`** runs the migration and backfill on a copy of production and compares the dashboard queries of both versions on its largest projects.

## Setup

The tools use the local services from `docker-compose.yml` and the root `.env`. They create and drop their own databases (`vm_compare_*`, `vm_loadtest_*`) and use a separate, disposable Redis, so your development data is not touched:

```sh
docker compose up -d postgres clickhouse
docker compose --profile test up -d redis-test
```

Set `INGESTION_TOOLS_REDIS_URL` to use a different disposable Redis (default `redis://localhost:16389`). Telemetry export (`AXIOM_TOKEN`) is disabled for all processes the tools start.

Other refs than `.` run in a git worktree under the system temp directory (`vemetric-ingestion-tools/worktrees`), created and installed on first use. Remove them with `git worktree remove <path>` or `git worktree prune` after deleting the directory.

## Compare two versions

```sh
bun run --cwd scripts/ingestion compare -- --base main --head .
```

`.` is the current checkout including uncommitted changes. `--replicas 3` starts three instances of every worker in the scenario to include concurrent processing. The command exits with 1 and lists the differing paths if the snapshots differ; both snapshots are kept in the temp directory for inspection.

The scenario (`compare/scenario.integration.test.ts`) is copied into the hub tests of each version and removed afterwards. It runs the in-process hub and workers on a controlled clock, so timestamps and durations are comparable. It covers anonymous visitors on several devices, referrers and UTM tags, custom and server-side events, page leaves, identification, a user merge, new sessions after inactivity and a burst of concurrent visitors. It may only use APIs that exist in every version you compare.

## Load test

```sh
bun run --cwd scripts/ingestion loadtest -- --rate 1000 --duration 60 --workers 3 --unique 0.5
```

| Option            | Default | Meaning                                                                      |
| ----------------- | ------- | ---------------------------------------------------------------------------- |
| `--ref`           | `.`     | Code version to run                                                          |
| `--rate`          | `500`   | Pageviews per second sent to the hub                                         |
| `--duration`      | `60`    | Seconds of traffic                                                           |
| `--workers`       | `1`     | Worker processes (each runs all workers, like a production replica)          |
| `--unique`        | `0.5`   | Share of events from one-off identities (bot-like traffic without any reuse) |
| `--drain-timeout` | `600`   | Seconds to wait for the backlog to drain after the traffic stops             |

The remaining traffic comes from returning visitors with five pageviews each, at most one per second, plus a page leave. Every five seconds the tool prints the accepted rate, the backlog per queue, pending session snapshots and Redis memory. At the end it prints a report and writes it with all samples and the process logs to a directory under `vemetric-ingestion-tools`.

The report checks that the stored data matches what was sent: every accepted pageview is an event, and every identity is one user with one device and one session. The command exits with 1 if the backlog did not drain, requests failed or the data does not match.

Everything runs on one machine, so the hub, the workers, Redis and ClickHouse compete for the same CPU. Use the numbers to compare versions and worker counts with each other, not as production capacity. For older versions whose worker has a fixed health-check port, use `--workers 1`.

## Query benchmark

```sh
bun run --cwd scripts/ingestion benchmark -- --sessions 3000000 --months 3 --base main
```

It creates `vm_loadtest_benchmark`, generates `--sessions` sessions over `--months` months with events, devices and identified users (`--largest-share` of them in one project, which every query targets), runs the backfill (reporting its duration), and adds two unmerged revisions to last week's sessions, like live traffic. It then runs each dashboard query `--runs` times with the model code of `--base` against the legacy tables and of the current checkout against the new ones, and prints median duration, peak memory (from `system.query_log`) and result sizes. `--reuse-data` skips the generation for repeated runs.

## Production check

`prod-check` only reads: ClickHouse queries go over HTTP GET, which ClickHouse always runs read-only, and Redis only receives `INFO`, `CONFIG GET` and key-count commands. The output contains settings, versions, table sizes and counts for the ten largest projects without their ids, no customer data. For extra safety, create a dedicated read-only user:

```sql
CREATE USER vemetric_check IDENTIFIED BY '<password>' SETTINGS readonly = 1;
GRANT SELECT ON vemetric.* TO vemetric_check;
```

Then run it from a machine that can reach production:

```sh
PROD_CHECK_CLICKHOUSE_URL=https://... PROD_CHECK_CLICKHOUSE_USER=vemetric_check PROD_CHECK_CLICKHOUSE_PASSWORD=... \
PROD_CHECK_CLICKHOUSE_DB=vemetric PROD_CHECK_REDIS_URL=redis://... bun run --cwd scripts/ingestion prod-check > prod-check.json
```

## Migration rehearsal on a production copy

Run this only against a copy of the production ClickHouse database (for example restored from a backup onto a separate server), never against production itself:

```sh
REHEARSAL_CLICKHOUSE_URL=https://copy-host:8443 REHEARSAL_CLICKHOUSE_USER=default REHEARSAL_CLICKHOUSE_PASSWORD=... \
REHEARSAL_CLICKHOUSE_DB=vemetric bun run --cwd scripts/ingestion rehearsal -- --confirm-copy copy-host
```

`--confirm-copy` must repeat the host name of the target. The script applies migration 15, runs the real backfill (the same command as in production, including its verification) and reports how long both took. It then compares the dashboard queries of `--base` (default `main`, on the legacy tables) with the current checkout (on the new tables) for the `--projects` largest projects (default 3). The printed tables and the JSON report contain durations, table sizes, memory and result sizes only; projects appear by rank, never by id. Use `--skip-migration` to repeat only the query comparison.
