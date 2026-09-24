import type { ClickHouseClient } from '@clickhouse/client-web';

export async function assertIngestionSchema(client: ClickHouseClient) {
  const result = await client.query({
    query: `SELECT count() AS count FROM system.tables
      WHERE database = currentDatabase() AND name IN ('session_v3', 'device_v2')`,
    format: 'JSONEachRow',
  });
  if (Number((await result.json<{ count: string }>())[0]?.count) !== 2) {
    throw new Error('Apply ClickHouse migration 15 before running the ingestion backfill or workers');
  }
}
