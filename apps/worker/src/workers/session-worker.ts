import { getGeoDataFromIp } from '@vemetric/common/geo';
import { sessionQueueName } from '@vemetric/queues/queue-names';
import type { SessionQueueProps } from '@vemetric/queues/session-queue';
import { Worker } from 'bullmq';
import type { ClickhouseUser } from 'clickhouse';
import { clickhouseSession, clickhouseUser } from 'clickhouse';
import { getDeviceDataFromHeaders } from '../utils/device';
import { logJobStep } from '../utils/job-logger';
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

      await logJobStep(job, `start type=${type} project=${projectId} user=${userId} session=${sessionId}`);
      await logJobStep(job, 'before clickhouseSession.findById');
      const existingSession = await clickhouseSession.findById(projectId, userId, sessionId);
      await logJobStep(
        job,
        existingSession ? 'after clickhouseSession.findById existing' : 'after clickhouseSession.findById missing',
      );
      if (existingSession) {
        await logJobStep(job, 'before increaseClickhouseSessionDuration');
        await increaseClickhouseSessionDuration(
          existingSession,
          createdAt,
          type === 'createOrExtend' ? job.data.geoData : undefined,
        );
        await logJobStep(job, 'done extended existing session');
      } else {
        if (type === 'extend') {
          await logJobStep(job, 'done missing session for extend');
          return;
        }

        const { ipAddress, geoData, headers, url, reqIdentifier, reqDisplayName } = job.data;

        await logJobStep(job, 'before clickhouseUser.findById');
        const user: ClickhouseUser | null = await clickhouseUser.findById(projectId, userId);
        await logJobStep(job, user ? 'after clickhouseUser.findById found' : 'after clickhouseUser.findById missing');
        const userIdentifier = user?.identifier ?? reqIdentifier;
        const userDisplayName = user?.displayName ?? reqDisplayName;

        const userAgent = headers['user-agent'];
        await logJobStep(job, 'before getReferrerFromRequest');
        const referrer = await getReferrerFromRequest(projectId, headers, url);
        await logJobStep(job, 'after getReferrerFromRequest');
        const urlParams = getUrlParams(url);

        await logJobStep(job, 'before getDeviceDataFromHeaders');
        const deviceData = await getDeviceDataFromHeaders(headers);
        await logJobStep(job, 'after getDeviceDataFromHeaders');

        await logJobStep(job, geoData || !ipAddress ? 'before getSessionData' : 'before getGeoDataFromIp');
        const sessionData = await getSessionData(
          geoData || (ipAddress ? await getGeoDataFromIp(ipAddress, logger, 5000) : undefined),
          user,
          deviceData,
        );
        await logJobStep(job, 'after getSessionData');

        await logJobStep(job, 'before clickhouseSession.insert');
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
        await logJobStep(job, 'done created session');
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
