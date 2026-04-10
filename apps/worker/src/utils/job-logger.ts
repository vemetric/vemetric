import type { Job } from 'bullmq';

const isJobDebugLoggingEnabled = process.env.BULLMQ_JOB_DEBUG_LOGS === 'true';

export async function logJobStep(job: Pick<Job, 'log'>, message: string) {
  if (!isJobDebugLoggingEnabled) {
    return;
  }

  try {
    await job.log(message);
  } catch {
    // Best effort only; worker processing should not depend on debug job logs.
  }
}

