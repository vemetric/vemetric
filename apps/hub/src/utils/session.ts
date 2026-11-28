import { SESSION_DURATION_MINUTES, sessionIdRedisKey } from '@vemetric/common/session';
import { generateSessionId } from 'database';
import { getRedisClient } from './redis';

const REDIS_SESSION_DURATION = 60 * SESSION_DURATION_MINUTES;

export async function getSessionId(projectId: bigint, userId: bigint) {
  const redisClient = await getRedisClient();
  const sessionKey = sessionIdRedisKey(projectId, userId);
  return redisClient.get(sessionKey);
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

// Hands over KEYS[1]'s active session to KEYS[2] (unless KEYS[2] already has one) and clears KEYS[1],
// so another visitor or a later account on KEYS[1] never inherits a session moved to KEYS[2].
// When ARGV[2] is non-empty, only hands over if KEYS[1] still holds that exact session id.
export const CONTINUE_SESSION = `
local id = redis.call('GET', KEYS[1])
if not id then return 0 end
if ARGV[2] and ARGV[2] ~= '' and id ~= ARGV[2] then return 0 end
redis.call('DEL', KEYS[1])
if redis.call('SET', KEYS[2], id, 'EX', ARGV[1], 'NX') then return 1 end
return 0`;

/**
 * When a visitor logs in, the identified user continues the visitor's session, so the visit stays
 * one session with its real start, landing page and referrer. The merge then moves the session to
 * the user. A user who is already active (e.g. on another device) keeps their own session; the
 * merge joins both into one visit.
 */
export async function continueSession(
  projectId: bigint,
  fromUserId: bigint,
  toUserId: bigint,
  expectedSessionId?: string,
) {
  const redis = await getRedisClient();
  await redis.eval(CONTINUE_SESSION, {
    keys: [sessionIdRedisKey(projectId, fromUserId), sessionIdRedisKey(projectId, toUserId)],
    arguments: [String(REDIS_SESSION_DURATION), expectedSessionId ?? ''],
  });
}

export async function getOrCreateSessionId(projectId: bigint, userId: bigint) {
  const redis = await getRedisClient();
  const [sessionId, created] = (await redis.eval(GET_OR_CREATE_SESSION, {
    keys: [sessionIdRedisKey(projectId, userId)],
    arguments: [generateSessionId(), String(REDIS_SESSION_DURATION)],
  })) as [string, number];
  return { sessionId: String(sessionId), isNewSession: Number(created) === 1 };
}

export async function increaseRedisSessionDuration(projectId: bigint, userId: bigint, sessionId: string) {
  const redis = await getRedisClient();
  return (
    Number(
      await redis.eval(REFRESH_SESSION, {
        keys: [sessionIdRedisKey(projectId, userId)],
        arguments: [sessionId, String(REDIS_SESSION_DURATION)],
      }),
    ) === 1
  );
}
