# Vemetric Health Check Integration Test

This is an integration test that runs via a cronjob every 15 minutes and check if the tracked event also is being stored correctly in Clickhouse.

With this we ensure that our critical systems are up and running, including the Hub API, Redis DB, Queue Workers and the Clickhouse DB.
