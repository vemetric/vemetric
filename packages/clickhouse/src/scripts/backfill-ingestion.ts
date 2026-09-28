/* eslint-disable no-console -- a manual command-line tool; its output belongs in the terminal, also where AXIOM_TOKEN is set */
import { createClient } from '@clickhouse/client-web';
import { backfillIngestion } from '../ingestion-backfill';

async function main() {
  if (process.argv.slice(2).join(' ') !== '--writers-stopped') {
    throw new Error('Usage: bun run backfill-ingestion --writers-stopped (all ClickHouse writers must be stopped)');
  }
  const timeout = Number(process.env.INGESTION_BACKFILL_TIMEOUT_MS ?? 3_600_000);
  if (!Number.isSafeInteger(timeout) || timeout < 1) throw new Error('Invalid INGESTION_BACKFILL_TIMEOUT_MS');
  const client = createClient({
    database: process.env.CLICKHOUSE_DB ?? 'vemetric',
    host: process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER ?? 'default',
    password: process.env.CLICKHOUSE_PASSWORD ?? '',
    request_timeout: timeout,
    clickhouse_settings: { output_format_json_quote_64bit_integers: 1 },
  });
  try {
    await backfillIngestion(client, { writersStopped: true, progress: (message) => console.log(message) });
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error('Ingestion backfill failed:', error);
  process.exitCode = 1;
});
