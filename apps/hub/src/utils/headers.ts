import { createHash } from 'node:crypto';

/**
 * Headers that are safe to store and useful for analytics/debugging.
 * All other headers are filtered out for privacy.
 */
const ALLOWED_HEADERS = new Set([
  'user-agent',
  'referer',
  // Vemetric SDK headers
  'allow-cookies',
  'v-sdk',
  'v-sdk-version',
  'v-host',
  'v-referrer',
]);

export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    // Keep allowed headers and all Client Hints (sec-ch-*)
    if (ALLOWED_HEADERS.has(lowerKey) || lowerKey.startsWith('sec-ch-')) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Fingerprint of the headers device detection reads (user agent and client hints). Equal
 * fingerprints resolve to the same device, so the hub enqueues only one device job per
 * user and fingerprint within the deduplication window.
 */
export function getDeviceHeadersFingerprint(headers: Record<string, string>): string {
  const deviceHeaders = Object.entries(headers)
    .map(([key, value]) => [key.toLowerCase(), value] as const)
    .filter(([key]) => key === 'user-agent' || key.startsWith('sec-ch-'))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return createHash('sha1').update(JSON.stringify(deviceHeaders)).digest('hex');
}
