import type { ClickHouseSettings, ErrorLogParams, Logger, LogParams, WarnLogParams } from '@clickhouse/client-web';
import { ClickHouseLogLevel, createClient } from '@clickhouse/client-web';
import { jsonStringify } from '@vemetric/common/json';
import { createLogger } from '@vemetric/logger';

const logger = createLogger('clickhouse');

class CustomLogger implements Logger {
  trace({ message, args }: LogParams) {
    logger.trace(args, message);
  }
  debug({ message, args }: LogParams) {
    logger.debug(args, message);
  }
  info({ message, args }: LogParams) {
    logger.info(args, message);
  }
  warn({ message, args }: WarnLogParams) {
    logger.warn(args, message);
  }
  error({ message, args, err }: ErrorLogParams) {
    logger.error(
      {
        ...args,
        err,
      },
      message,
    );
  }
}

export const clickhouseClient = createClient({
  database: process.env.CLICKHOUSE_DB ?? 'vemetric',
  host: process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER ?? 'default',
  password: process.env.CLICKHOUSE_PASSWORD ?? '',
  max_open_connections: 50,
  request_timeout: 60000,
  keep_alive: {
    enabled: true,
  },
  compression: {
    request: true,
  },
  clickhouse_settings: {
    // ClickHouse 26 can return UInt64 values as JSON numbers. IDs exceed JS' safe
    // integer range, so force quoted integers before parsing them into BigInt.
    output_format_json_quote_64bit_integers: 1,
    // Rows that replace each other always share a partition (a session's startedAt never
    // changes), so FINAL can resolve each partition independently: much faster, same result.
    do_not_merge_across_partitions_select_final: 1,
  },
  log: {
    LoggerClass: CustomLogger,
    level: ClickHouseLogLevel.INFO,
  },
});

/**
 * Settings for high-volume ingestion writes (events, devices). ClickHouse batches concurrent
 * small inserts from all worker replicas server-side instead of creating one part per job.
 * `wait_for_async_insert` keeps job completion tied to persistence, and
 * `async_insert_deduplicate` keeps the retry deduplication of synchronous inserts on
 * replicated tables. Set `CLICKHOUSE_ASYNC_INSERTS=false` to insert synchronously.
 */
export function ingestionInsertSettings(): ClickHouseSettings | undefined {
  if (process.env.CLICKHOUSE_ASYNC_INSERTS === 'false') return undefined;
  return {
    async_insert: 1,
    wait_for_async_insert: 1,
    async_insert_deduplicate: 1,
    async_insert_use_adaptive_busy_timeout: 0,
    async_insert_busy_timeout_ms: 100,
  };
}

export const clickhouseInsert = async <T>({
  table,
  values,
  settings,
}: {
  table: string;
  values: ReadonlyArray<T>;
  settings?: ClickHouseSettings;
}) => {
  return await clickhouseClient.insert({
    table,
    values: JSON.parse(jsonStringify(values)),
    format: 'JSONEachRow',
    clickhouse_settings: settings,
  });
};
