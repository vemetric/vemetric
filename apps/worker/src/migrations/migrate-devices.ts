/* eslint-disable no-console */
import type { ClickHouseClient } from '@clickhouse/client';
import { ClickHouseLogLevel, createClient } from '@clickhouse/client';
import { clickhouseDevice } from 'clickhouse/src/models/device';
import { getDeviceId } from 'clickhouse/src/utils/id';
import { getDeviceDataFromHeaders } from '../utils/device';
import { logger } from '../utils/logger';

const INITIAL_OFFSET = 0;
const BATCH_SIZE = 10000;
const MUTATION_CHECK_INTERVAL = 5000; // Check mutations every 5 seconds

const deletedDeviceIds: Set<string> = new Set();
const insertedDeviceIds: Set<string> = new Set();
const updatedUserIds: Set<string> = new Set();
const onlyChangeDetection = true;
const onlyUserAgent = true;

async function waitForMutations(client: ClickHouseClient) {
  while (true) {
    const result = await client.query({
      query: `
        SELECT count() as count 
        FROM system.mutations 
        WHERE table = 'event'  OR table = 'device' OR table = 'user'
        AND is_done = 0
      `,
      format: 'JSONEachRow',
    });

    const [{ count }] = (await result.json()) as [{ count: number }];

    if (count < 1000) {
      return;
    }

    logger.info(`Waiting for ${count} mutations to complete ...`);
    await new Promise((resolve) => setTimeout(resolve, MUTATION_CHECK_INTERVAL));
  }
}

async function updateDevices() {
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
    logger.info(`Starting device update`);
    let offset = INITIAL_OFFSET;
    let totalProcessed = 0;

    while (true) {
      const result = await client.query({
        query: `
          SELECT id, projectId, userId, deviceId, userAgent, requestHeaders, osName, osVersion, clientName, clientVersion, clientType, deviceType
          FROM event
          WHERE userAgent <> '' AND requestHeaders <> '{}'
          ORDER BY createdAt DESC
          LIMIT ${BATCH_SIZE}
          OFFSET ${offset}
        `,
        format: 'JSONEachRow',
      });

      const rows = (await result.json()) as Array<{
        id: string;
        projectId: string;
        userId: string;
        deviceId: string;
        userAgent: string;
        requestHeaders: string;
        osName: string;
        osVersion: string;
        clientName: string;
        clientVersion: string;
        clientType: string;
        deviceType: string;
      }>;

      if (rows.length === 0) break;

      let skipped = 0;
      let processed = 0;
      const promises: Promise<any>[] = [];
      for (const row of rows) {
        const requestHeaders = JSON.parse(row.requestHeaders);
        const deviceData = await getDeviceDataFromHeaders(
          onlyUserAgent ? { 'user-agent': row.userAgent } : requestHeaders,
        );
        const deviceId = getDeviceId(BigInt(row.projectId), BigInt(row.userId), deviceData);
        const hasChanged = row.deviceId !== String(deviceId);

        if (!hasChanged) {
          skipped++;
          if (!insertedDeviceIds.has(String(deviceId))) {
            insertedDeviceIds.add(String(deviceId));
          }
          continue;
        } else {
          processed++;
          if (row.osName !== deviceData.osName) {
            console.log('osName changed', {
              old: row.osName,
              new: deviceData.osName,
            });
          }
          if (row.osVersion !== deviceData.osVersion) {
            console.log('osVersion changed', {
              old: row.osVersion,
              new: deviceData.osVersion,
            });
          }
          const knownChangesOld = ['Brave', 'Opera GX'];
          const knownChangesNew = ['Mobile Chrome'];
          if (
            row.clientName !== deviceData.clientName &&
            !knownChangesOld.includes(row.clientName) &&
            !knownChangesNew.includes(deviceData.clientName)
          ) {
            console.log('clientName changed', {
              old: row.clientName,
              new: deviceData.clientName,
            });
          }
          if (row.clientVersion !== deviceData.clientVersion) {
            console.log('clientVersion changed', {
              old: row.clientVersion,
              new: deviceData.clientVersion,
            });
          }
          if (row.clientType !== deviceData.clientType) {
            console.log('clientType changed', {
              old: row.clientType,
              new: deviceData.clientType,
            });
          }
          if (row.deviceType !== deviceData.deviceType) {
            console.log('deviceType changed', {
              old: row.deviceType,
              new: deviceData.deviceType,
            });
          }
          if (onlyChangeDetection) {
            continue;
          }
        }

        promises.push(
          client.query({
            query: `
            ALTER TABLE event
            UPDATE
              deviceId = {deviceId:String},
              osName = {osName:String},
              osVersion = {osVersion:String},
              clientName = {clientName:String},
              clientVersion = {clientVersion:String},
              clientType = {clientType:String},
              deviceType = {deviceType:String}
            WHERE id = {id:String}
          `,
            query_params: {
              id: row.id,
              deviceId: String(deviceId),
              osName: deviceData.osName,
              osVersion: deviceData.osVersion,
              clientName: deviceData.clientName,
              clientVersion: deviceData.clientVersion,
              clientType: deviceData.clientType,
              deviceType: deviceData.deviceType,
            },
          }),
        );
        if (!insertedDeviceIds.has(String(deviceId))) {
          insertedDeviceIds.add(String(deviceId));
          promises.push(
            clickhouseDevice.insert([
              {
                projectId: BigInt(row.projectId),
                userId: BigInt(row.userId),
                id: deviceId,
                ...deviceData,
              },
            ]),
          );
        }
        if (!deletedDeviceIds.has(row.deviceId)) {
          deletedDeviceIds.add(row.deviceId);
          promises.push(
            client.query({
              query: `
            ALTER TABLE device DELETE WHERE id = {oldDeviceId:String}
          `,
              query_params: {
                oldDeviceId: row.deviceId,
              },
            }),
          );
        }
        if (!updatedUserIds.has(row.userId)) {
          updatedUserIds.add(row.userId);
          promises.push(
            client.query({
              query: `
            ALTER TABLE user
            UPDATE
              initialDeviceId = {deviceId:String}
            WHERE initialDeviceId = {oldDeviceId:String}
          `,
              query_params: {
                deviceId: String(deviceId),
                oldDeviceId: row.deviceId,
              },
            }),
          );
        }

        processed++;
        if (promises.length >= 1) {
          logger.info(`Processed ${processed} records, skipped ${skipped} records`);
          await Promise.all(promises);
          promises.length = 0;
          await new Promise((resolve) => setTimeout(resolve, 100));
          await waitForMutations(client);
        }
      }

      totalProcessed += processed;
      offset += BATCH_SIZE;

      logger.info(`Processed ${totalProcessed} records, offset: ${offset}`);
    }

    logger.info('Device update completed successfully');
  } catch (err) {
    logger.error({ err }, 'Error updating devices:');
    throw err;
  } finally {
    await client.close();
  }
}

// Run the migration
updateDevices().catch((error) => {
  logger.error('Migration failed:', error);
  process.exit(1);
});
