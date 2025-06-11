import { ClickHouseLogLevel, createClient } from '@clickhouse/client';
import { dbUserIdentificationMap } from 'database';
import { logger } from '../utils/logger';

const INITIAL_OFFSET = 0;
const BATCH_SIZE = 10000;

async function updateUserIdentifications() {
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
    logger.info(`Starting user identification update`);
    let offset = INITIAL_OFFSET;
    let totalProcessed = 0;

    while (true) {
      const result = await client.query({
        query: `
          SELECT id, projectId, identifier
          FROM user
          ORDER BY createdAt ASC
          LIMIT ${BATCH_SIZE}
          OFFSET ${offset}
        `,
        format: 'JSONEachRow',
      });

      const rows = (await result.json()) as Array<{
        id: string;
        projectId: string;
        identifier: string;
      }>;

      if (rows.length === 0) break;

      let skipped = 0;
      let processed = 0;
      const bulkCreateData: Array<{ projectId: string; userId: string; identifier: string }> = [];
      for (const row of rows) {
        const existingUser =
          bulkCreateData.find((createData) => createData.projectId === row.projectId && createData.userId === row.id) ||
          (await dbUserIdentificationMap.findByUserId(row.projectId, row.id));
        if (existingUser) {
          if (existingUser.identifier !== row.identifier) {
            logger.info(`Updating user ${row.id} from ${existingUser.identifier} to ${row.identifier}`);
            await dbUserIdentificationMap.update(row.projectId, row.id, row.identifier);
            processed++;
          } else {
            skipped++;
          }
        } else {
          bulkCreateData.push({ projectId: row.projectId, userId: row.id, identifier: row.identifier });
          logger.info(`Creating user ${row.id} with identifier ${row.identifier}`);
          processed++;
        }

        if ((processed + skipped) % 100 === 0) {
          if (bulkCreateData.length > 0) {
            await dbUserIdentificationMap.createMany(bulkCreateData);
            bulkCreateData.length = 0;
          }
          logger.info(`Processed ${processed} records, skipped ${skipped} records`);
        }
      }

      totalProcessed += processed;
      offset += BATCH_SIZE;

      logger.info(`Processed ${totalProcessed} records, offset: ${offset}`);
    }

    logger.info('Migration completed successfully');
  } catch (err) {
    logger.error({ err }, 'Error migrating:');
    throw err;
  } finally {
    await client.close();
  }
}

// Run the migration
updateUserIdentifications().catch((error) => {
  logger.error('Migration failed:', error);
  process.exit(1);
});
