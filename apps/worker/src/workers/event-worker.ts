import { EventNames } from '@vemetric/common/event';
import type { EventQueueProps } from '@vemetric/queues/event-queue';
import { eventQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import type { ClickhouseUser } from 'clickhouse';
import { clickhouseEvent, clickhouseUser, getDeviceId } from 'clickhouse';
import { getDeviceDataFromHeaders } from '../utils/device';
import { getReferrerFromRequest } from '../utils/referrer';
import { getSessionData } from '../utils/session';
import { getUrlParams } from '../utils/url';

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
        reqIdentifier,
        reqDisplayName,
        headers,
        customData,
        createdAt,
      } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);
      const isPageView = name === EventNames.PageView;

      const user: ClickhouseUser | null = await clickhouseUser.findById(projectId, userId);
      const userIdentifier = user?.identifier ?? reqIdentifier;
      const userDisplayName = reqDisplayName ?? user?.displayName;

      const userAgent = headers['user-agent'];
      const referrer = await getReferrerFromRequest(projectId, headers, url);
      const urlParams = getUrlParams(url);

      const deviceData = await getDeviceDataFromHeaders(headers);

      const sessionData = await getSessionData(ipAddress, user, deviceData);

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
      concurrency: 10,
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
