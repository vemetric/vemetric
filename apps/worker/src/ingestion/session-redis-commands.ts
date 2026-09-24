import type Redis from 'ioredis';

// These commands only enforce atomic storage changes. Session calculations stay in TypeScript.
// Dynamic key count: the dirty set followed by every session participating in the update.
const commitSessions = `
for i=2,#KEYS do
  if (redis.call('GET', KEYS[i]) or '') ~= ARGV[(i-2)*2+1] then return 0 end
end
for i=2,#KEYS do
  local old = redis.call('GET', KEYS[i])
  if old then
    local s = cjson.decode(old).session
    if s then redis.call('SREM', 'vm:{session-state}:user:'..s.projectId..':'..s.userId, KEYS[i]) end
  end
  local value = ARGV[(i-2)*2+2]
  redis.call('SET', KEYS[i], value)
  local state = cjson.decode(value)
  local s = state.session
  if s then redis.call('SADD', 'vm:{session-state}:user:'..s.projectId..':'..s.userId, KEYS[i]) end
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
redis.call('ZREM', KEYS[2], KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
local s = cjson.decode(ARGV[1]).session
if s then redis.call('SREM', 'vm:{session-state}:user:'..s.projectId..':'..s.userId, KEYS[1]) end
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
