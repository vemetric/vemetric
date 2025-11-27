import { getGeoDataFromIp } from '@vemetric/common/geo';
import { sessionQueueName } from '@vemetric/queues/queue-names';
import type { SessionQueueProps } from '@vemetric/queues/session-queue';
import { Worker } from 'bullmq';
import type { ClickhouseUser } from 'clickhouse';
import { clickhouseSession, clickhouseUser } from 'clickhouse';
import { getDeviceDataFromHeaders } from '../utils/device';
import { logger } from '../utils/logger';
import { getReferrerFromRequest } from '../utils/referrer';
import { getSessionData, increaseClickhouseSessionDuration } from '../utils/session';
import { getUrlParams } from '../utils/url';

export async function initSessionWorker() {
  return new Worker<SessionQueueProps>(
    sessionQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId, sessionId, createdAt, type } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      const existingSession = await clickhouseSession.findById(projectId, userId, sessionId);
      if (existingSession) {
        await increaseClickhouseSessionDuration(existingSession, createdAt);
      } else {
        if (type === 'extend') {
          return;
        }

        const { ipAddress, geoData, headers, url, reqIdentifier, reqDisplayName } = job.data;

        const user: ClickhouseUser | null = await clickhouseUser.findById(projectId, userId);
        const userIdentifier = user?.identifier ?? reqIdentifier;
        const userDisplayName = user?.displayName ?? reqDisplayName;

        const userAgent = headers['user-agent'];
        const referrer = await getReferrerFromRequest(projectId, headers, url);
        const urlParams = getUrlParams(url);

        const deviceData = await getDeviceDataFromHeaders(headers);

        const sessionData = await getSessionData(
          geoData || (ipAddress ? await getGeoDataFromIp(ipAddress, logger, 5000) : undefined),
          user,
          deviceData,
        );

        await clickhouseSession.insert([
          {
            projectId,
            userId,
            userIdentifier,
            userDisplayName,
            id: sessionId,
            startedAt: createdAt,
            endedAt: createdAt,
            duration: 0,
            ...sessionData,
            ...urlParams,
            userAgent,
            ...referrer,
          },
        ]);
      }
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      concurrency: 1,
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
