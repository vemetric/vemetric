import type Redis from 'ioredis';

export const userKeyPrefix = 'vm:{user-state}:';

// Compare-and-set of one user state. A changed user row is marked dirty for the flusher and kept
// without expiry until it is written; a deleted marker is removed from the dirty set and expires;
// other states expire (clean users, updates still waiting for their user).
const commitUser = `
if (redis.call('GET', KEYS[2]) or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2])
if ARGV[3] == '1' then
  redis.call('ZADD', KEYS[1], 'NX', ARGV[4], KEYS[2])
elseif ARGV[3] == '2' then
  redis.call('ZREM', KEYS[1], KEYS[2])
  redis.call('EXPIRE', KEYS[2], ARGV[5])
elseif not redis.call('ZSCORE', KEYS[1], KEYS[2]) then
  redis.call('EXPIRE', KEYS[2], ARGV[5])
end
return 1`;

// Only the flush of the current state makes it clean. A flush of an older state may have been
// written after a newer one, and the user table keeps the last inserted row on merges, so the
// newer state is marked dirty again: its next flush becomes the last inserted row. A deleted
// user is never re-dirtied or persisted.
const acknowledgeUser = `
local current = redis.call('GET', KEYS[1])
if current == ARGV[1] then
  redis.call('ZREM', KEYS[2], KEYS[1])
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return 1
end
if current then
  if cjson.decode(current).deleted then
    redis.call('ZREM', KEYS[2], KEYS[1])
    if redis.call('TTL', KEYS[1]) == -1 then
      redis.call('EXPIRE', KEYS[1], ARGV[4])
    end
  else
    redis.call('ZADD', KEYS[2], ARGV[3], KEYS[1])
    redis.call('PERSIST', KEYS[1])
  end
end
return 0`;

export interface UserCommands {
  commitUser(
    dirtyKey: string,
    stateKey: string,
    expected: string,
    next: string,
    mode: '0' | '1' | '2',
    now: number,
    ttlSeconds: number,
  ): Promise<number>;
  acknowledgeUser(
    stateKey: string,
    dirtyKey: string,
    snapshot: string,
    ttlSeconds: number,
    now: number,
    deletedTtlSeconds: number,
  ): Promise<number>;
}

export function registerUserCommands<T extends Redis>(client: T): T & UserCommands {
  client.defineCommand('commitUser', { numberOfKeys: 2, lua: commitUser });
  client.defineCommand('acknowledgeUser', { numberOfKeys: 2, lua: acknowledgeUser });
  return client as T & UserCommands;
}
