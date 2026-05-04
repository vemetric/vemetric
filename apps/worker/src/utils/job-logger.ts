import type { Job } from 'bullmq';

const isJobDebugLoggingEnabled = process.env.BULLMQ_JOB_DEBUG_LOGS === 'true';

function stringifyJobLogDetails(details: Record<string, unknown>) {
  return JSON.stringify(details, (_key, value: unknown) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }

    return value;
  });
}

export async function logJobStep(
  job: Pick<Job, 'log'> | null | undefined,
  message: string,
  details?: Record<string, unknown>,
) {
  if (!isJobDebugLoggingEnabled) {
    return;
  }

  if (!job) {
    return;
  }

  try {
    await job.log(details ? `${message} ${stringifyJobLogDetails(details)}` : message);
  } catch {
    // Best effort only; worker processing should not depend on debug job logs.
  }
}
