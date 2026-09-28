/**
 * Reads the used memory (bytes) and its share of `maxmemory` from the output of `INFO memory`.
 * The ratio is undefined when Redis has no memory limit (`maxmemory` 0).
 */
export function parseRedisMemoryInfo(info: string) {
  const fields = new Map<string, string>();
  for (const line of info.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      fields.set(line.slice(0, separator), line.slice(separator + 1));
    }
  }

  const usedMemory = Number(fields.get('used_memory'));
  if (!Number.isFinite(usedMemory)) {
    throw new Error('INFO memory has no used_memory');
  }
  const maxMemory = Number(fields.get('maxmemory') ?? 0);
  return { usedMemory, memoryRatio: maxMemory > 0 ? usedMemory / maxMemory : undefined };
}
