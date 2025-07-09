import { createReadStream } from 'fs';
import { join } from 'path';
import { ClickHouseLogLevel, createClient } from '@clickhouse/client';
import type { ClickhouseDevice } from 'clickhouse/src/models/device';
import { clickhouseDevice } from 'clickhouse/src/models/device';
import type { ClickhouseEvent } from 'clickhouse/src/models/event';
import { clickhouseEvent } from 'clickhouse/src/models/event';
import type { ClickhouseSession } from 'clickhouse/src/models/session';
import { clickhouseSession } from 'clickhouse/src/models/session';
import { getDeviceId } from 'clickhouse/src/utils/id';
import csv from 'csv-parser';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';

const BATCH_SIZE = 1000;

// Helper function to parse CSV using csv-parser
function parseCSV(filePath: string): Promise<Array<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    const results: Array<Record<string, string>> = [];

    createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => results.push(row))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Helper function to parse array-like strings from CSV
function parseArrayField(field: string): string[] {
  if (!field || field === '{}') return [];

  try {
    // Handle the format: {'value'} -> ['value']
    if (field.startsWith('{') && field.endsWith('}')) {
      const content = field.slice(1, -1);
      if (content.startsWith("'") && content.endsWith("'")) {
        return [content.slice(1, -1)];
      }
    }
    return JSON.parse(field);
  } catch {
    return [];
  }
}

// Helper function to check if date is before cutoff
function isDateBeforeCutoff(dateString: string, cutoffDate: Date | null): boolean {
  if (!cutoffDate) return true;
  const eventDate = new Date(dateString);
  return eventDate < cutoffDate;
}

// Helper function to process sessions with sign column
// Only keeps the latest entry with sign = 1 for each visitor_id + session_id combination
function processSessionsWithSign(sessions: Array<Record<string, string>>): Array<Record<string, string>> {
  const sessionMap = new Map<string, Record<string, string>>();

  // Sort by time to process in chronological order
  const sortedSessions = sessions.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  for (const session of sortedSessions) {
    const key = `${session.visitor_id}-${session.session_id}`;
    const sign = parseInt(session.sign);

    if (sign === 1) {
      // Add or update the session
      sessionMap.set(key, session);
    } else if (sign === -1) {
      logger.info(`Removing session ${key} with sign -1`);
      // Remove the session (delete operation)
      sessionMap.delete(key);
    }
  }

  return Array.from(sessionMap.values());
}

// Helper function to get device data from raw data
function getDeviceDataFromRaw(row: Record<string, string>) {
  const osName = row.os === 'Mac OS' ? 'macOS' : row.os;
  return {
    osName: osName || '',
    osVersion: row.os_version || '',
    clientName: row.browser || '',
    clientVersion: row.browser_version || '',
    clientType: 'browser' as const,
    deviceType: (row.mobile === '1' ? 'mobile' : row.desktop === '1' ? 'desktop' : 'unknown') as
      | 'desktop'
      | 'mobile'
      | 'tablet'
      | 'console'
      | 'smarttv'
      | 'wearable'
      | 'embedded'
      | 'server'
      | 'unknown',
  };
}

async function importRawData() {
  const client = createClient({
    database: process.env.CH_MIGRATIONS_DB ?? 'vemetric',
    host: process.env.CH_MIGRATIONS_HOST ?? 'http://localhost:8123',
    username: process.env.CH_MIGRATIONS_USER ?? 'default',
    password: process.env.CH_MIGRATIONS_PASSWORD ?? '',
    compression: { response: true, request: true },
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

  if (!process.env.IMPORT_PROJECT_ID) {
    throw new Error('IMPORT_PROJECT_ID must be set');
  }
  const projectId = BigInt(process.env.IMPORT_PROJECT_ID!);
  const importSource = 'pirsch';

  if (!process.env.IMPORT_CUTOFF_DATE) {
    throw new Error('IMPORT_CUTOFF_DATE must be set');
  }

  // Date filter - only import data before this date
  const cutoffDate = new Date(process.env.IMPORT_CUTOFF_DATE);
  if (cutoffDate) {
    logger.info(`Only importing data before: ${cutoffDate.toISOString()}`);
  }
  //throw new Error("Don't import data if there is already data for this in Vemetric to avoid duplicates");
  // TODO: also  strip out sessions with sign = -1

  try {
    const rawExportPath = join(process.cwd(), 'raw-export');

    // Track unique devices to avoid duplicates
    const uniqueDevices = new Map<string, Omit<ClickhouseDevice, 'createdAt'>>();

    logger.info('Starting raw data import...');

    // 1. Import page views as events
    logger.info('Importing page views as events...');
    const pageViews = await parseCSV(join(rawExportPath, 'page_views.csv'));

    // Filter page views by date if cutoff is specified
    const filteredPageViews = cutoffDate
      ? pageViews.filter((row) => isDateBeforeCutoff(row.time, cutoffDate))
      : pageViews;

    logger.info(`Processing ${filteredPageViews.length} page views (filtered from ${pageViews.length})`);

    for (let i = 0; i < filteredPageViews.length; i += BATCH_SIZE) {
      const batch = filteredPageViews.slice(i, i + BATCH_SIZE);
      const events: ClickhouseEvent[] = batch.map((row) => {
        const deviceData = getDeviceDataFromRaw(row);
        const userId = BigInt(row.visitor_id);
        const deviceId = getDeviceId(projectId, userId, deviceData);

        // Track unique devices
        const deviceKey = `${projectId}-${userId}-${deviceId}`;
        if (!uniqueDevices.has(deviceKey)) {
          uniqueDevices.set(deviceKey, {
            projectId,
            userId,
            id: deviceId,
            ...deviceData,
            importSource,
          });
        }

        return {
          projectId,
          userId,
          sessionId: row.session_id,
          deviceId,
          contextId: nanoid(),
          createdAt: row.time,
          id: nanoid(),
          name: '$$pageView',
          isPageView: true,

          // Device data
          ...deviceData,

          // Geo data
          countryCode: (row.country_code || '').toUpperCase(),
          city: row.city || '',
          latitude: null,
          longitude: null,

          // URL data
          origin: row.hostname ? `https://${row.hostname}` : '',
          pathname: row.path || '',
          urlHash: '',
          queryParams: {},

          // UTM data
          utmSource: row.utm_source || '',
          utmMedium: row.utm_medium || '',
          utmCampaign: row.utm_campaign || '',
          utmContent: row.utm_content || '',
          utmTerm: row.utm_term || '',

          // Referrer data
          referrer: row.referrer_name || '',
          referrerUrl: row.referrer || '',
          referrerType: row.channel || '',

          // User data
          userAgent: '',
          userIdentifier: '',
          userDisplayName: row.title || '',

          // Request data
          requestHeaders: {},
          customData: {},

          importSource,
        };
      });

      await clickhouseEvent.insert(events);
      logger.info(`Imported ${events.length} page view events (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }

    // 2. Import custom events
    logger.info('Importing custom events...');
    const customEvents = await parseCSV(join(rawExportPath, 'events.csv'));

    // Filter custom events by date if cutoff is specified
    const filteredCustomEvents = cutoffDate
      ? customEvents.filter((row) => isDateBeforeCutoff(row.time, cutoffDate))
      : customEvents;

    logger.info(`Processing ${filteredCustomEvents.length} custom events (filtered from ${customEvents.length})`);

    for (let i = 0; i < filteredCustomEvents.length; i += BATCH_SIZE) {
      const batch = filteredCustomEvents.slice(i, i + BATCH_SIZE);
      const events: ClickhouseEvent[] = batch
        .map((row) => {
          if (!row.event_name) {
            return null;
          }

          const deviceData = getDeviceDataFromRaw(row);
          const userId = BigInt(row.visitor_id);
          const deviceId = getDeviceId(projectId, userId, deviceData);

          // Track unique devices
          const deviceKey = `${projectId}-${userId}-${deviceId}`;
          if (!uniqueDevices.has(deviceKey)) {
            uniqueDevices.set(deviceKey, {
              projectId,
              userId,
              id: deviceId,
              ...deviceData,
              importSource,
            });
          }

          // Parse custom event metadata
          const metaKeys = parseArrayField(row.event_meta_keys);
          const metaValues = parseArrayField(row.event_meta_values);
          const customData: Record<string, any> = {};

          metaKeys.forEach((key, index) => {
            if (metaValues[index]) {
              customData[key] = metaValues[index];
            }
          });

          const eventName = row.event_name === 'Outbound Link Click' ? '$$outboundLink' : row.event_name;

          return {
            projectId,
            userId,
            sessionId: row.session_id,
            deviceId,
            contextId: nanoid(),
            createdAt: row.time,
            id: nanoid(),
            name: eventName,
            isPageView: false,

            // Device data
            ...deviceData,

            // Geo data
            countryCode: (row.country_code || '').toUpperCase(),
            city: row.city || '',
            latitude: null,
            longitude: null,

            // URL data
            origin: row.hostname ? `https://${row.hostname}` : '',
            pathname: row.path || '',
            urlHash: '',
            queryParams: {},

            // UTM data
            utmSource: row.utm_source || '',
            utmMedium: row.utm_medium || '',
            utmCampaign: row.utm_campaign || '',
            utmContent: row.utm_content || '',
            utmTerm: row.utm_term || '',

            // Referrer data
            referrer: row.referrer_name || '',
            referrerUrl: row.referrer || '',
            referrerType: row.channel || '',

            // User data
            userAgent: '',
            userIdentifier: '',
            userDisplayName: row.title || '',

            // Request data
            requestHeaders: {},
            customData,

            importSource,
          };
        })
        .filter((event) => event !== null);

      await clickhouseEvent.insert(events);
      logger.info(`Imported ${events.length} custom events (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }

    // 3. Import sessions
    logger.info('Importing sessions...');
    const sessions = await parseCSV(join(rawExportPath, 'sessions.csv'));

    // Process sessions to handle sign column (only keep final state with sign = 1)
    const processedSessions = processSessionsWithSign(sessions);
    logger.info(
      `Processed sessions with sign column: ${processedSessions.length} final sessions (from ${sessions.length} total entries)`,
    );

    // Filter sessions by date if cutoff is specified
    const filteredSessions = cutoffDate
      ? processedSessions.filter((row) => isDateBeforeCutoff(row.time, cutoffDate))
      : processedSessions;

    logger.info(`Processing ${filteredSessions.length} sessions (filtered from ${processedSessions.length})`);

    for (let i = 0; i < filteredSessions.length; i += BATCH_SIZE) {
      const batch = filteredSessions.slice(i, i + BATCH_SIZE);
      const sessionData: ClickhouseSession[] = batch.map((row) => {
        const userId = BigInt(row.visitor_id);

        return {
          projectId,
          userId,
          id: row.session_id,
          userIdentifier: '',
          userDisplayName: '',
          startedAt: row.start || row.time,
          endedAt: row.time,
          duration: parseInt(row.duration_seconds) || 0,

          // Geo data
          countryCode: (row.country_code || '').toUpperCase(),
          city: row.city || '',
          latitude: null,
          longitude: null,

          // URL data
          origin: row.hostname ? `https://${row.hostname}` : '',
          pathname: row.entry_path || '',
          urlHash: '',
          queryParams: {},

          // UTM data
          utmSource: row.utm_source || '',
          utmMedium: row.utm_medium || '',
          utmCampaign: row.utm_campaign || '',
          utmContent: row.utm_content || '',
          utmTerm: row.utm_term || '',

          // Referrer data
          referrer: row.referrer_name || '',
          referrerUrl: row.referrer || '',
          referrerType: row.channel || '',

          userAgent: '',
          importSource,
        };
      });

      await clickhouseSession.insert(sessionData);
      logger.info(`Imported ${sessionData.length} sessions (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }

    // 4. Import devices
    logger.info('Importing devices...');
    const deviceArray = Array.from(uniqueDevices.values());

    for (let i = 0; i < deviceArray.length; i += BATCH_SIZE) {
      const batch = deviceArray.slice(i, i + BATCH_SIZE);
      await clickhouseDevice.insert(batch);
      logger.info(`Imported ${batch.length} devices (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }

    logger.info('Raw data import completed successfully!');
    logger.info(
      `Total imported: ${filteredPageViews.length} page views, ${filteredCustomEvents.length} custom events, ${filteredSessions.length} sessions, ${deviceArray.length} unique devices`,
    );
  } catch (err) {
    logger.error({ err }, 'Error importing raw data:');
    throw err;
  } finally {
    await client.close();
  }
}

// Run the import
importRawData().catch((err) => {
  logger.error({ err }, 'Import failed:');
  process.exit(1);
});
