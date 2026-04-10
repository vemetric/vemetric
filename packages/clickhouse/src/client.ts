import type { ErrorLogParams, Logger, LogParams, WarnLogParams } from '@clickhouse/client-web';
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
  log: {
    LoggerClass: CustomLogger,
    level: ClickHouseLogLevel.INFO,
  },
});

export const clickhouseInsert = async <T>({ table, values }: { table: string; values: ReadonlyArray<T> }) => {
  return await clickhouseClient.insert({
    table,
    values: JSON.parse(jsonStringify(values)),
    format: 'JSONEachRow',
  });
};
