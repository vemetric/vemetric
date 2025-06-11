import type { ClickHouseClient } from '@clickhouse/client';
import { ClickHouseLogLevel, createClient } from '@clickhouse/client';
import { dbProject } from 'database';
import { referrers } from '../consts/referrers';
import { logger } from '../utils/logger';
import { getReferrer } from '../utils/referrer';

const BATCH_SIZE = 10000;
const SEPARATOR = '\u001F'; // ASCII Unit Separator - guaranteed not to appear in URLs
const MAX_IDS_PER_UPDATE = 500; // Maximum number of IDs to include in a single UPDATE query
const MUTATION_CHECK_INTERVAL = 10000; // Check mutations every 10 seconds
const MAX_PARALLEL_UPDATES = 50;

// Helper function to chunk array into smaller arrays
function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size));
}

async function waitForMutations(client: ClickHouseClient, tableName: string) {
  while (true) {
    const result = await client.query({
      query: `
        SELECT count() as count 
        FROM system.mutations 
        WHERE table = '${tableName}' 
        AND is_done = 0
      `,
      format: 'JSONEachRow',
    });

    const [{ count }] = (await result.json()) as [{ count: number }];

    if (count < 1000) {
      return;
    }

    logger.info(`Waiting for ${count} mutations to complete on ${tableName}...`);
    await new Promise((resolve) => setTimeout(resolve, MUTATION_CHECK_INTERVAL));
  }
}

async function processBatch(
  client: ClickHouseClient,
  tableName: string,
  rows: Array<{ id: string; projectId: string; referrer: string; referrerUrl: string }>,
  projectMap: Map<string, any>,
) {
  // Group updates by referrer type to minimize number of queries
  const updates = new Map<string, string[]>();

  for (const row of rows) {
    const project = projectMap.get(row.projectId);
    if (!project) {
      logger.error(`Project ${row.projectId} not found`);
      continue;
    }

    const resolvedReferrer = referrers[(row.referrerUrl || row.referrer) as keyof typeof referrers];

    const referrerData = resolvedReferrer
      ? {
          referrer: resolvedReferrer.name,
          referrerUrl: row.referrerUrl || row.referrer,
          referrerType: resolvedReferrer.type,
        }
      : getReferrer(project.domain, row.referrerUrl || row.referrer);
    if (!referrerData) continue;

    const key = `${referrerData.referrer}${SEPARATOR}${referrerData.referrerUrl}${SEPARATOR}${referrerData.referrerType}`;
    if (!updates.has(key)) {
      updates.set(key, []);
    }
    updates.get(key)!.push(row.id);
  }

  // Create all update operations
  const updateOperations: Array<{
    referrer: string;
    referrerUrl: string;
    referrerType: string;
    ids: string[];
  }> = [];

  for (const [key, ids] of Array.from(updates)) {
    const [referrer, referrerUrl, referrerType] = key.split(SEPARATOR);
    const idChunks = chunkArray(ids, MAX_IDS_PER_UPDATE);

    for (const idChunk of idChunks) {
      updateOperations.push({
        referrer: referrer || '',
        referrerUrl: referrerUrl || '',
        referrerType,
        ids: idChunk,
      });
    }
  }

  // Process updates in parallel batches
  const operationChunks = chunkArray(updateOperations, MAX_PARALLEL_UPDATES);

  for (const chunk of operationChunks) {
    await Promise.all(
      chunk.map(async (operation) => {
        await client.query({
          query: `
            ALTER TABLE ${tableName}
            UPDATE 
              referrer = {referrer:String},
              referrerUrl = {referrerUrl:String},
              referrerType = {referrerType:String}
            WHERE id IN {ids:Array(String)}
          `,
          query_params: operation,
        });
        logger.debug(`Updated ${operation.ids.length} records in ${tableName}`);
      }),
    );

    // Wait for mutations to complete before processing next batch
    await waitForMutations(client, tableName);
  }

  return rows.length;
}

async function updateTable(
  client: ClickHouseClient,
  tableName: string,
  projectMap: Map<string, any>,
  initialOffset = 0,
) {
  logger.info(`Starting ${tableName} referrer update`);
  let offset = initialOffset;
  let totalProcessed = 0;

  while (true) {
    const result = await client.query({
      query: `
        SELECT id, projectId, referrer, referrerUrl
        FROM ${tableName}
        WHERE referrer <> '' ${tableName !== 'event' ? 'AND deleted = 0' : ''}
        ORDER BY ${tableName === 'session' ? 'startedAt' : 'createdAt'} ASC
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      `,
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as Array<{
      id: string;
      projectId: string;
      referrer: string;
      referrerUrl: string;
    }>;

    if (rows.length === 0) break;

    const processed = await processBatch(client, tableName, rows, projectMap);
    totalProcessed += processed;
    offset += BATCH_SIZE;

    logger.info(`Processed ${totalProcessed} ${tableName} records`);
  }
}

async function updateReferrers() {
  const client = createClient({
    database: process.env.CH_MIGRATIONS_DB ?? 'vemetric',
    host: process.env.CH_MIGRATIONS_HOST ?? 'http://localhost:8123',
    username: process.env.CH_MIGRATIONS_USER ?? 'default',
    password: process.env.CH_MIGRATIONS_PASSWORD ?? '',
    compression: { response: true, request: true }, // Enable compression for better network performance
    max_open_connections: 1000,
    request_timeout: 60000,
    keep_alive: {
      enabled: true,
      idle_socket_ttl: 8000,
    },
    log: {
      level: ClickHouseLogLevel.INFO,
    },
  });

  try {
    const projects = await dbProject.findAll();
    const projectMap = new Map(projects.map((project) => [project.id, project]));

    // Process tables sequentially to avoid overwhelming the server
    await updateTable(client, 'event', projectMap);
    await updateTable(client, 'session', projectMap);
    await updateTable(client, 'user', projectMap);

    logger.info('Referrer update completed successfully');
  } catch (err) {
    logger.error({ err }, 'Error updating referrers:');
    throw err;
  } finally {
    await client.close();
  }
}

// Run the migration
updateReferrers().catch((error) => {
  logger.error('Migration failed:', error);
  process.exit(1);
});
