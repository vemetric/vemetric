import { SESSION_DURATION_MINUTES } from '@vemetric/common/session';
import { getRedisClient } from './redis';

const REDIS_SESSION_DURATION = 60 * SESSION_DURATION_MINUTES;

function getRedisSessionKey(projectId: bigint, userId: bigint) {
  return `sessionid:${projectId}:${userId}`;
}

export async function getSessionId(projectId: bigint, userId: bigint) {
  const redisClient = await getRedisClient();
  const sessionKey = getRedisSessionKey(projectId, userId);
  const sessionId = (await redisClient?.get(sessionKey)) ?? null;
  return sessionId;
}

export async function hasActiveSession(projectId: bigint, userId: bigint) {
  return (await getSessionId(projectId, userId)) !== null;
}

export async function increaseRedisSessionDuration(projectId: bigint, userId: bigint, sessionId: string) {
  const redisClient = await getRedisClient();
  await redisClient?.setEx(getRedisSessionKey(projectId, userId), REDIS_SESSION_DURATION, sessionId);
}
