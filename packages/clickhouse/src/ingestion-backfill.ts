import type { ClickHouseClient } from '@clickhouse/client-web';
import { assertIngestionSchema } from './ingestion-schema';

const sessionFields = [
  'userId',
  'startedAt',
  'endedAt',
  'duration',
  'userIdentifier',
  'userDisplayName',
  'countryCode',
  'city',
  'latitude',
  'longitude',
  'userAgent',
  'referrer',
  'referrerUrl',
  'referrerType',
  'origin',
  'pathname',
  'queryParams',
  'urlHash',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'importSource',
];
const deviceFields = [
  'createdAt',
  'osName',
  'osVersion',
  'clientName',
  'clientVersion',
  'clientType',
  'deviceType',
  'importSource',
];
const unpack = (fields: string[]) => fields.map((field, i) => `row.${i + 1} AS ${field}`).join(', ');

// One-time legacy reads only. Whole-row tuples preserve NULL and make equal-time
// selection deterministic across retries. Runtime analytics do not use FINAL.
const copies = [
  {
    table: 'session_v3',
    columns: ['projectId', 'id', ...sessionFields, 'revision', 'deleted'],
    source: `SELECT projectId, id, ${unpack(sessionFields)},
      toUInt64(1) AS revision, toInt8(0) AS deleted
      FROM (
        SELECT projectId, id,
          argMax(tuple(${sessionFields.join(', ')}), tuple(endedAt, tuple(${sessionFields.join(', ')}))) AS row
        FROM session FINAL WHERE projectId = {projectId:UInt64} AND deleted = 0 AND id != ''
        GROUP BY projectId, id
      )`,
  },
  {
    table: 'device_v2',
    columns: ['projectId', 'userId', 'id', ...deviceFields, 'revision', 'deleted'],
    source: `SELECT projectId, userId, id, ${unpack(deviceFields)},
      toUInt64(toUInt64('18446744073709551614') - toUInt64(toUnixTimestamp64Milli(row.1))) AS revision,
      toInt8(0) AS deleted
      FROM (
        SELECT projectId, userId, id,
          argMin(tuple(${deviceFields.join(', ')}), tuple(${deviceFields.join(', ')})) AS row
        FROM device FINAL WHERE projectId = {projectId:UInt64}
        GROUP BY projectId, userId, id HAVING sum(sign) > 0
      )`,
  },
];

export async function backfillIngestion(
  client: ClickHouseClient,
  { writersStopped, progress = () => {} }: { writersStopped: boolean; progress?: (message: string) => void },
) {
  if (!writersStopped) throw new Error('Stop all ClickHouse writers and pass --writers-stopped');
  await assertIngestionSchema(client);
  const schema = await client.query({
    query: `SELECT name, engine_full AS engine FROM system.tables
      WHERE database = currentDatabase() AND name IN ('session', 'device')`,
    format: 'JSONEachRow',
  });
  const tables = await schema.json<{ name: string; engine: string }>();
  if (
    !tables.some((t) => t.name === 'session' && t.engine.startsWith('ReplacingMergeTree(endedAt)')) ||
    !tables.some((t) => t.name === 'device' && t.engine.startsWith('CollapsingMergeTree(sign)'))
  ) {
    throw new Error('Expected legacy session ReplacingMergeTree(endedAt) and device CollapsingMergeTree(sign)');
  }

  const projectsResult = await client.query({
    query: `SELECT DISTINCT toString(projectId) AS projectId FROM (
      SELECT projectId FROM session UNION ALL SELECT projectId FROM device
      UNION ALL SELECT projectId FROM session_v3 UNION ALL SELECT projectId FROM device_v2
    ) ORDER BY projectId`,
    format: 'JSONEachRow',
  });
  const projects = await projectsResult.json<{ projectId: string }>();
  for (let index = 0; index < projects.length; index++) {
    const { projectId } = projects[index]!;
    for (const copy of copies) {
      const columns = copy.columns.join(', ');
      const target = `SELECT ${columns} FROM ${copy.table} WHERE projectId = {projectId:UInt64}`;
      progress(`[${index + 1}/${projects.length}] Project ${projectId}: copying ${copy.table}`);
      // Copy only missing rows. An interrupted insert may have committed some or
      // all rows; retries keep them and never truncate or overwrite either table.
      await client.command({
        query: `INSERT INTO ${copy.table} (${columns}) ${copy.source} EXCEPT DISTINCT ${target}`,
        query_params: { projectId },
        clickhouse_settings: { async_insert: 0 },
      });
      // Compare complete rows in both directions, not physical row counts or hashes.
      // An unexpected target row also fails verification (e.g. premature new writes).
      for (const [left, right] of [
        [copy.source, target],
        [target, copy.source],
      ]) {
        const mismatch = await client.query({
          query: `SELECT count() AS count FROM (SELECT * FROM (${left} EXCEPT DISTINCT ${right}) LIMIT 1)`,
          query_params: { projectId },
          format: 'JSONEachRow',
        });
        if (Number((await mismatch.json<{ count: string }>())[0]?.count) !== 0) {
          throw new Error(`Backfill verification failed: project ${projectId}, ${copy.table}; keep workers stopped`);
        }
      }
      progress(`[${index + 1}/${projects.length}] Project ${projectId}: verified ${copy.table}`);
    }
  }
  progress('Backfill complete. Both tables verified. Confirm deployment readiness before starting workers.');
}
