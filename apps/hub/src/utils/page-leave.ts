import { formatClickhouseDate } from '@vemetric/common/date';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { sessionQueue } from '@vemetric/queues/session-queue';
import type { HonoContext } from '../types';
import { getUserIdFromRequest } from './request';
import { getSessionId, increaseRedisSessionDuration } from './session';

export async function handlePageLeave(context: HonoContext) {
  const { text } = context;

  const { projectId } = context.var;

  const userId = await getUserIdFromRequest(context);
  if (userId === null) {
    return text('User is not identified', 401);
  }

  const sessionId = await getSessionId(projectId, userId);
  if (sessionId === null) {
    return text('Session has not started', 401);
  }

  await increaseRedisSessionDuration(projectId, userId, sessionId);

  await addToQueue(
    sessionQueue,
    {
      type: 'extend',
      projectId: String(projectId),
      userId: String(userId),
      sessionId,
      createdAt: formatClickhouseDate(new Date()),
    },
    {
      // Buffered extensions are safe even when they arrive before session creation.
    },
  );

  return text('', 200);
}
