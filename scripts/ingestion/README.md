# Ingestion tools

Tools to check ingestion changes before they reach production:

- **`compare`** runs one fixed traffic scenario through two code versions and diffs the resulting analytics data (sessions, devices, users, events, dashboard queries). Use it to confirm that a change produces the same results.
- **`loadtest`** starts a hub and N worker processes locally, sends traffic over HTTP at a fixed rate and reports throughput, backlog, Redis memory and whether all sent data was stored. Use it to find where a version saturates.
- **`benchmark`** generates session, device, event and user data at a chosen scale and runs the dashboard queries of two versions against it. Use it to catch slower or more memory-hungry queries.

## Setup

The tools use the local services from `docker-compose.yml` and the root `.env`. They create and drop their own databases (`vm_compare_*`, `vm_loadtest_*`) and use a separate, disposable Redis, so your development data is not touched:

```sh
docker compose up -d postgres clickhouse
docker compose --profile test up -d redis-test
```

The code versions you run or compare need the `session_v3` and `device_v2` tables (migration 15 or later).

Set `INGESTION_TOOLS_REDIS_URL` to use a different disposable Redis (default `redis://localhost:16389`). Telemetry export (`AXIOM_TOKEN`) is disabled for all processes the tools start.

Other refs than `.` run in a git worktree in `~/.cache/vemetric-ingestion-tools/worktrees`, created and installed on first use. Reports and snapshots are written to `~/.cache/vemetric-ingestion-tools` as well. Remove the directory and run `git worktree prune` to clean up.

## Compare two versions

```sh
bun run --cwd scripts/ingestion compare -- --base main --head .
```

`.` is the current checkout including uncommitted changes. `--replicas 3` starts three instances of every worker in the scenario to include concurrent processing. The command exits with 1 and lists the differing paths if the snapshots differ; both snapshots are kept in `~/.cache/vemetric-ingestion-tools` for inspection.

The scenario (`compare/scenario.ts`) is copied into the hub tests as a vitest file of each version and removed afterwards. It runs the in-process hub and workers on a controlled clock, so timestamps and durations are comparable. It covers anonymous visitors on several devices, referrers and UTM tags, custom and server-side events, page leaves, identification, a user merge, new sessions after inactivity and a burst of concurrent visitors. It may only use APIs that exist in every version you compare. Before the snapshot it merges the session, device and event tables (`OPTIMIZE ... FINAL`), so it compares the settled state: reads without `FINAL` can briefly differ depending on when ClickHouse merges parts in the background, which varies between runs.

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

The remaining traffic comes from returning visitors with five pageviews each, at most one per second, plus a page leave. Every five seconds the tool prints the accepted rate, the backlog per queue, pending session snapshots and Redis memory. At the end it prints a report and writes it with all samples and the process logs to a directory under `~/.cache/vemetric-ingestion-tools`.

The report checks that the stored data matches what was sent: every accepted pageview is an event, and every identity is one user with one device and one session. The command exits with 1 if the backlog did not drain, requests failed or the data does not match.

Everything runs on one machine, so the hub, the workers, Redis and ClickHouse compete for the same CPU. Use the numbers to compare versions and worker counts with each other, not as production capacity.

## Query benchmark

```sh
bun run --cwd scripts/ingestion benchmark -- --sessions 3000000 --months 3 --base main
```

It creates `vm_loadtest_benchmark`, generates `--sessions` sessions over `--months` months with events, devices and identified users (`--largest-share` of them in one project, which every query targets), and adds two unmerged revisions to last week's sessions, like live traffic. It then runs each dashboard query `--runs` times with the model code of `--base` and of the current checkout, and prints median duration, peak memory (from `system.query_log`) and result sizes. `--reuse-data` skips the generation for repeated runs.
