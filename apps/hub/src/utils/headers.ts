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
