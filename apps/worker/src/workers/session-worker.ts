import { getGeoDataFromIp } from '@vemetric/common/geo';
import { sessionQueueName } from '@vemetric/queues/queue-names';
import type { SessionQueueProps } from '@vemetric/queues/session-queue';
import { sessionQueue } from '@vemetric/queues/session-queue';
import { Worker } from 'bullmq';
import type { ClickhouseUser } from 'clickhouse';
import { clickhouseUser } from 'clickhouse';
import {
  assertIngestionStateStorage,
  bufferSessionUpdate,
  bufferExistingSessionActivity,
} from '../ingestion';
import { workerConcurrency } from '../utils/concurrency';
import { getDeviceDataFromHeaders } from '../utils/device';
import { logJobStep } from '../utils/job-logger';
import { logger } from '../utils/logger';
import { getReferrerFromRequest } from '../utils/referrer';
import { getSessionData } from '../utils/session';
import { queueTelemetry } from '../utils/telemetry';
import { getUrlParams } from '../utils/url';

export async function initSessionWorker() {
  await assertIngestionStateStorage();
  await sessionQueue.removeGlobalConcurrency();
  return new Worker<SessionQueueProps>(
    sessionQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId, sessionId, createdAt, type } = job.data;

      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      if (type === 'extend') {
        await bufferSessionUpdate(projectId, sessionId, createdAt);
        return;
      }
      if (await bufferExistingSessionActivity(projectId, sessionId, createdAt, job.data.geoData)) return;
      {
        const { ipAddress, geoData, headers, url, reqIdentifier, reqDisplayName } = job.data;

        await logJobStep(job, 'before clickhouseUser.findById');
        const user: ClickhouseUser | null = await clickhouseUser.findById(projectId, userId);
        await logJobStep(job, user ? 'after clickhouseUser.findById found' : 'after clickhouseUser.findById missing');
        const userIdentifier = user?.identifier ?? reqIdentifier;
        const userDisplayName = user?.displayName ?? reqDisplayName;

        const userAgent = headers['user-agent'];
        await logJobStep(job, 'before getReferrerFromRequest');
        const referrer = await getReferrerFromRequest(projectId, headers, url, job.data.projectDomain);
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

        await logJobStep(job, 'before bufferSessionUpdate');
        await bufferSessionUpdate(projectId, sessionId, createdAt, {
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
        });
        await logJobStep(job, 'session update buffered');
      }
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      telemetry: queueTelemetry,
      concurrency: workerConcurrency('SESSION_WORKER_CONCURRENCY', 20),
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
