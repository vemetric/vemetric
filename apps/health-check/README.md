# Vemetric Health Check Integration Test

This is an integration test that runs via a cronjob every 15 minutes and check if the tracked event also is being stored correctly in Clickhouse.

With this we ensure that our critical systems are up and running, including the Hub API, Redis DB, Queue Workers and the Clickhouse DB.

## Alerting

If the health check fails, it reports the failure to [PagerDeck](https://pagerdeck.com) with severity `error`. Repeated failures are grouped into one incident through a fixed `dedup_key`. The incident resolves automatically 30 minutes after the last failure (`ttl`), i.e. after two passing runs.

| Variable               | Description                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `PAGERDECK_INGEST_KEY` | Ingest key of the PagerDeck source (`src_live_...`). Reporting is skipped if not set. |
| `PAGERDECK_API_URL`    | Optional, defaults to `https://api.pagerdeck.com/v1/push`                             |
