import { describe, it, expect } from 'vitest';
import { parseRedisMemoryInfo } from '../../src/utils/redis-info';

const info = (fields: Record<string, string>) =>
  ['# Memory', ...Object.entries(fields).map(([key, value]) => `${key}:${value}`), ''].join('\r\n');

describe('parseRedisMemoryInfo', () => {
  it('should return used memory and its ratio to maxmemory', () => {
    const result = parseRedisMemoryInfo(
      info({
        used_memory: '1073741824',
        used_memory_human: '1.00G',
        maxmemory: '4294967296',
        maxmemory_human: '4.00G',
      }),
    );
    expect(result).toEqual({ usedMemory: 1073741824, memoryRatio: 0.25 });
  });

  it('should not return a ratio without a memory limit', () => {
    const result = parseRedisMemoryInfo(info({ used_memory: '1048576', maxmemory: '0' }));
    expect(result).toEqual({ usedMemory: 1048576, memoryRatio: undefined });
  });

  it('should not return a ratio when maxmemory is missing', () => {
    expect(parseRedisMemoryInfo(info({ used_memory: '1048576' })).memoryRatio).toBeUndefined();
  });

  it('should parse LF line endings', () => {
    const result = parseRedisMemoryInfo('# Memory\nused_memory:200\nmaxmemory:1000\n');
    expect(result).toEqual({ usedMemory: 200, memoryRatio: 0.2 });
  });

  it('should throw without used_memory', () => {
    expect(() => parseRedisMemoryInfo(info({ maxmemory: '1000' }))).toThrow('used_memory');
  });
});
