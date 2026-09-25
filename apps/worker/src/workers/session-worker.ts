import { getGeoDataFromIp } from '@vemetric/common/geo';
import { sessionQueueName } from '@vemetric/queues/queue-names';
import type { SessionQueueProps } from '@vemetric/queues/session-queue';
import { sessionQueue } from '@vemetric/queues/session-queue';
import { DelayedError, Worker } from 'bullmq';
import { assertIngestionStateStorage, bufferSessionUpdate, bufferExistingSessionActivity } from '../ingestion';
import { workerConcurrency } from '../utils/concurrency';
import { getDeviceDataFromHeaders } from '../utils/device';
import { logJobStep } from '../utils/job-logger';
import { logger } from '../utils/logger';
import { getReferrerFromRequest } from '../utils/referrer';
import { getSessionData } from '../utils/session';
import { queueTelemetry } from '../utils/telemetry';
import { getUrlParams } from '../utils/url';
import { findIngestionUser } from '../utils/user-cache';

const CREATING_EVENT_WAIT_MS = 60_000;
const CREATING_EVENT_RECHECK_MS = 1_000;

export async function initSessionWorker() {
  await assertIngestionStateStorage();
  await sessionQueue.removeGlobalConcurrency();
  return new Worker<SessionQueueProps>(
    sessionQueueName,
    async (job, token) => {
      const { projectId: _projectId, userId: _userId, sessionId, createdAt, type } = job.data;

      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      if (type === 'extend') {
        await bufferSessionUpdate(projectId, sessionId, createdAt);
        return;
      }
      const activity = await bufferExistingSessionActivity(projectId, sessionId, createdAt, job.data.geoData, {
        knownNew: job.data.isNewSession,
      });
      if (activity === 'buffered') return;
      // A later event of a new session overtook the event that created it. Wait for that event, so it
      // sets the session start and entry data as sequential processing did. After the wait (e.g. the
      // creating job failed permanently) this event creates the session itself.
      if (
        activity === 'uninitialized' &&
        job.data.isNewSession === false &&
        Date.now() - job.timestamp < CREATING_EVENT_WAIT_MS
      ) {
        await job.moveToDelayed(Date.now() + CREATING_EVENT_RECHECK_MS, token);
        throw new DelayedError();
      }
      {
        const { ipAddress, geoData, headers, url, reqIdentifier, reqDisplayName } = job.data;

        await logJobStep(job, 'before findIngestionUser');
        const user = await findIngestionUser(projectId, userId);
        await logJobStep(job, user ? 'after findIngestionUser found' : 'after findIngestionUser missing');
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
      concurrency: workerConcurrency('SESSION_WORKER_CONCURRENCY', 50),
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
