#!/bin/sh
# Applies all pending Postgres and ClickHouse migrations. Runs once on every deployment,
# before the application containers are started.
set -eu

echo "Applying Postgres migrations..."
./node_modules/.bin/prisma migrate deploy --schema packages/database/prisma/schema.prisma

echo "Applying ClickHouse migrations..."
./node_modules/.bin/clickhouse-migrations migrate --migrations-home=packages/clickhouse/migrations

echo "Migrations applied."
