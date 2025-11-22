import { getCountryFromIP } from '@vemetric/common/geo';
import { logger } from './logger';

interface CacheEntry {
  countryCode: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 10000;

function cleanupExpiredEntries(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];

  cache.forEach((entry, ip) => {
    if (entry.expiresAt <= now) {
      expiredKeys.push(ip);
    }
  });

  expiredKeys.forEach((ip) => cache.delete(ip));

  if (expiredKeys.length > 0) {
    logger.trace({ cleaned: expiredKeys.length, cacheSize: cache.size }, 'Cleaned expired geo cache entries');
  }
}

setInterval(cleanupExpiredEntries, CACHE_TTL_MS);

function evictIfNeeded(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const toRemove = Math.floor(MAX_CACHE_SIZE * 0.1);
    const entries = Array.from(cache.keys());

    for (let i = 0; i < toRemove && i < entries.length; i++) {
      cache.delete(entries[i]);
    }

    logger.debug({ removed: toRemove, cacheSize: cache.size }, 'Evicted old geo cache entries');
  }
}

export async function getCountryFromIPCached(ipAddress: string): Promise<string | null> {
  if (!ipAddress) {
    return null;
  }

  const now = Date.now();
  const cached = cache.get(ipAddress);

  if (cached && cached.expiresAt > now) {
    return cached.countryCode;
  }

  const countryCode = await getCountryFromIP(ipAddress);

  evictIfNeeded();
  cache.set(ipAddress, {
    countryCode,
    expiresAt: now + CACHE_TTL_MS,
  });

  return countryCode;
}
