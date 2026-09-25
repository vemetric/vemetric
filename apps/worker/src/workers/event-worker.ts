import { EventNames } from '@vemetric/common/event';
import { getGeoDataFromIp } from '@vemetric/common/geo';
import type { EventQueueProps } from '@vemetric/queues/event-queue';
import { eventQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import { clickhouseEvent, getDeviceId } from 'clickhouse';
import { workerConcurrency } from '../utils/concurrency';
import { getDeviceDataFromHeaders } from '../utils/device';
import { logger } from '../utils/logger';
import { getReferrerFromRequest } from '../utils/referrer';
import { getSessionData } from '../utils/session';
import { queueTelemetry } from '../utils/telemetry';
import { getUrlParams } from '../utils/url';
import { findIngestionUser } from '../utils/user-cache';

export async function initEventWorker() {
  return new Worker<EventQueueProps>(
    eventQueueName,
    async (job) => {
      const {
        projectId: _projectId,
        userId: _userId,
        eventId,
        sessionId,
        contextId,
        url,
        name,
        ipAddress,
        geoData,
        reqIdentifier,
        reqDisplayName,
        headers,
        customData,
        createdAt,
      } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);
      const isPageView = name === EventNames.PageView;

      const user = await findIngestionUser(projectId, userId);
      const userIdentifier = user?.identifier ?? reqIdentifier;
      const userDisplayName = reqDisplayName ?? user?.displayName;

      const userAgent = headers['user-agent'];
      const referrer = await getReferrerFromRequest(projectId, headers, url, job.data.projectDomain);
      const urlParams = getUrlParams(url);

      const deviceData = await getDeviceDataFromHeaders(headers);

      const sessionData = await getSessionData(
        geoData || (ipAddress ? await getGeoDataFromIp(ipAddress, logger, 5000) : undefined),
        user,
        deviceData,
      );

      // store device and event
      const deviceId = getDeviceId(projectId, userId, deviceData);

      await clickhouseEvent.insert([
        {
          createdAt,
          isPageView,
          projectId,
          userId,
          sessionId,
          contextId: contextId ?? '',
          deviceId,
          id: eventId,
          name,
          ...deviceData,
          ...sessionData,
          ...urlParams,
          userAgent,
          ...referrer,
          userIdentifier,
          userDisplayName,
          requestHeaders: headers ?? {},
          customData: customData ?? {},
        },
      ]);
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      telemetry: queueTelemetry,
      concurrency: workerConcurrency('EVENT_WORKER_CONCURRENCY', 200),
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
