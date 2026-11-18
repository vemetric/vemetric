import type Redis from 'ioredis';

export const sessionKeyPrefix = 'vm:{session-state}:';
// The scripts build user index keys themselves; sessionUserKey must produce the same ones.
export const userIndexPrefix = `${sessionKeyPrefix}user:`;

// These commands only enforce atomic storage changes. Session calculations stay in TypeScript.
// Dynamic key count: the dirty set followed by every session participating in the update.
// Redis does not roll back a script that fails halfway, so every value is decoded before the first write.
const commitSessions = `
local oldSessions, states = {}, {}
for i=2,#KEYS do
  local old = redis.call('GET', KEYS[i])
  if (old or '') ~= ARGV[(i-2)*2+1] then return 0 end
  states[i] = cjson.decode(ARGV[(i-2)*2+2])
  if old then
    -- Older state cjson cannot decode (e.g. lone surrogate escapes) must not block its replacement.
    local ok, decoded = pcall(cjson.decode, old)
    if ok then oldSessions[i] = decoded.session end
  end
end
for i=2,#KEYS do
  local s = oldSessions[i]
  if s then redis.call('SREM', '${userIndexPrefix}'..s.projectId..':'..s.userId, KEYS[i]) end
  redis.call('SET', KEYS[i], ARGV[(i-2)*2+2])
  local state = states[i]
  s = state.session
  if s then redis.call('SADD', '${userIndexPrefix}'..s.projectId..':'..s.userId, KEYS[i]) end
  if s or state.deleted then
    redis.call('ZADD', KEYS[1], 'NX', ARGV[#ARGV-1], KEYS[i])
  else
    -- Early activity is best-effort Redis state until session creation arrives.
    redis.call('EXPIRE', KEYS[i], ARGV[#ARGV])
    redis.call('ZREM', KEYS[1], KEYS[i])
  end
end
return 1`;

// A successful older write must never clear a newer pending update.
const acknowledgeSession = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  -- Give other pending sessions a turn when this one keeps receiving updates.
  if redis.call('ZSCORE', KEYS[2], KEYS[1]) then redis.call('ZADD', KEYS[2], ARGV[3], KEYS[1]) end
  return 0
end
-- Decode before writing; a snapshot cjson cannot decode is still acknowledged once it was persisted.
local ok, state = pcall(cjson.decode, ARGV[1])
redis.call('ZREM', KEYS[2], KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
local s = ok and state.session
if s then redis.call('SREM', '${userIndexPrefix}'..s.projectId..':'..s.userId, KEYS[1]) end
return 1`;

export interface IngestionCommands {
  commitSessions(keyCount: number, ...keysAndArguments: Array<string | number>): Promise<number>;
  acknowledgeSession(
    stateKey: string,
    dirtyKey: string,
    snapshot: string,
    ttlSeconds: number,
    now: number,
  ): Promise<number>;
}

export function registerIngestionCommands(client: Redis): Redis & IngestionCommands {
  client.defineCommand('commitSessions', { lua: commitSessions });
  client.defineCommand('acknowledgeSession', { numberOfKeys: 2, lua: acknowledgeSession });
  return client as Redis & IngestionCommands;
}
