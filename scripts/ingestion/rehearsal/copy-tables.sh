#!/usr/bin/env bash
# Copies the ClickHouse tables the rehearsal needs from production into a separate ClickHouse
# server. Production is only read (SHOW CREATE TABLE and SELECT, fine with the read-only user);
# the data streams through this machine and is not stored here. See scripts/ingestion/README.md.
#
#   SOURCE_CMD='ssh -C prod docker exec -i vemetric-clickhouse' \
#   TARGET_CMD='ssh -C rehearsal docker exec -i clickhouse-rehearsal' \
#   CONFIRM_TARGET_IS_COPY=yes scripts/ingestion/rehearsal/copy-tables.sh
set -euo pipefail

: "${SOURCE_CMD:?Set SOURCE_CMD, the command that runs clickhouse-client on production}"
: "${TARGET_CMD:?Set TARGET_CMD, the command that runs clickhouse-client on the rehearsal server}"
if [[ "${CONFIRM_TARGET_IS_COPY:-}" != "yes" ]]; then
  echo "The target tables are dropped and recreated. Set CONFIRM_TARGET_IS_COPY=yes to confirm" >&2
  echo "that TARGET_CMD points at the rehearsal server, not at production." >&2
  exit 1
fi
if [[ "$SOURCE_CMD" == "$TARGET_CMD" ]]; then
  echo "SOURCE_CMD and TARGET_CMD must differ." >&2
  exit 1
fi
if [[ -z "${SOURCE_PASSWORD:-}" ]]; then read -rs -p "Production ClickHouse password (${SOURCE_USER:-vemetric_check}): " SOURCE_PASSWORD; echo; fi
if [[ -z "${TARGET_PASSWORD+set}" ]]; then read -rs -p "Rehearsal ClickHouse password (${TARGET_USER:-default}): " TARGET_PASSWORD; echo; fi

SOURCE_USER=${SOURCE_USER:-vemetric_check}
TARGET_USER=${TARGET_USER:-default}
DB=${DB:-vemetric}
TABLES=${TABLES:-"_migrations user device session event"}

# SOURCE_CMD/TARGET_CMD are command prefixes (for example ssh + docker exec) and intentionally unquoted.
src() { $SOURCE_CMD clickhouse-client --user "$SOURCE_USER" --password "$SOURCE_PASSWORD" "$@"; }
dst() { $TARGET_CMD clickhouse-client --user "$TARGET_USER" --password "$TARGET_PASSWORD" "$@"; }

dst --query "CREATE DATABASE IF NOT EXISTS $DB"
for table in $TABLES; do
  echo "Copying $DB.$table ..."
  ddl=$(src --query "SHOW CREATE TABLE $DB.$table FORMAT TSVRaw")
  dst --query "DROP TABLE IF EXISTS $DB.$table"
  dst --query "$ddl"
  src --query "SELECT * FROM $DB.$table FORMAT Native" | dst --query "INSERT INTO $DB.$table FORMAT Native"
  source_rows=$(src --query "SELECT count() FROM $DB.$table")
  target_rows=$(dst --query "SELECT count() FROM $DB.$table")
  if [[ "$source_rows" != "$target_rows" ]]; then
    echo "Row count mismatch for $table: production $source_rows, copy $target_rows" >&2
    exit 1
  fi
  echo "  $target_rows rows"
done
echo "Copy complete."
