import { SESSION_DURATION_MINUTES } from '@vemetric/common/session';
import { generateSessionId } from 'database';
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

// Returns the session id and 1 when it was created by this call.
export const GET_OR_CREATE_SESSION = `
local id = redis.call('GET', KEYS[1])
local created = 0
if not id then
  id = ARGV[1]
  created = 1
end
redis.call('SET', KEYS[1], id, 'EX', ARGV[2])
return {id, created}`;

export const REFRESH_SESSION = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0`;

// Hands the session of KEYS[1] over to KEYS[2] unless KEYS[2] already has an active session.
// Returns the handed-over session id, or nil.
export const CONTINUE_SESSION = `
local id = redis.call('GET', KEYS[1])
if not id then return false end
if redis.call('SET', KEYS[2], id, 'EX', ARGV[1], 'NX') then return id end
return false`;

/**
 * When an anonymous visitor logs into an existing user, their next events belong to that user.
 * Continuing the anonymous session keeps the visit in one session with its real start, landing
 * page and referrer; the merge job then moves the session to the user. A user who is already
 * active elsewhere keeps their own session.
 */
export async function continueSession(projectId: bigint, fromUserId: bigint, toUserId: bigint) {
  const redis = await getRedisClient();
  const sessionId = await redis.eval(CONTINUE_SESSION, {
    keys: [getRedisSessionKey(projectId, fromUserId), getRedisSessionKey(projectId, toUserId)],
    arguments: [String(REDIS_SESSION_DURATION)],
  });
  return typeof sessionId === 'string' ? sessionId : null;
}

export async function getOrCreateSessionId(projectId: bigint, userId: bigint) {
  const redis = await getRedisClient();
  const [sessionId, created] = (await redis.eval(GET_OR_CREATE_SESSION, {
    keys: [getRedisSessionKey(projectId, userId)],
    arguments: [generateSessionId(), String(REDIS_SESSION_DURATION)],
  })) as [string, number];
  return { sessionId: String(sessionId), isNewSession: Number(created) === 1 };
}

export async function increaseRedisSessionDuration(projectId: bigint, userId: bigint, sessionId: string) {
  const redis = await getRedisClient();
  return (
    Number(
      await redis.eval(REFRESH_SESSION, {
        keys: [getRedisSessionKey(projectId, userId)],
        arguments: [sessionId, String(REDIS_SESSION_DURATION)],
      }),
    ) === 1
  );
}
