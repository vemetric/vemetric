// Reports health check failures to PagerDeck (https://pagerdeck.com/integrations/webhook)
const PAGERDECK_API_URL: string = process.env.PAGERDECK_API_URL ?? 'https://api.pagerdeck.com/v1/push';
const PAGERDECK_INGEST_KEY: string | undefined = process.env.PAGERDECK_INGEST_KEY;
const PAGERDECK_TIMEOUT_MS = 10000;

// Repeated failures are grouped into one incident until it's resolved in PagerDeck
const DEDUP_KEY = 'vemetric:health-check';
// The health check runs every 15 minutes, so the incident auto-resolves after two runs without a new failure
const TTL: string = process.env.PAGERDECK_TTL ?? '30m';

// API limits in UTF-8 bytes: title max 250 bytes, body max 8 KiB
const MAX_TITLE_BYTES = 250;
const MAX_BODY_BYTES = 8192;
const ELLIPSIS = '…';

// Truncates to a maximum number of UTF-8 bytes without cutting a character in half
export function truncateBytes(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value) <= maxBytes) {
    return value;
  }

  const budget = maxBytes - Buffer.byteLength(ELLIPSIS);
  let result = '';
  let bytes = 0;
  // Iterating a string yields whole code points, so surrogate pairs stay intact
  for (const char of value) {
    const charBytes = Buffer.byteLength(char);
    if (bytes + charBytes > budget) {
      break;
    }
    result += char;
    bytes += charBytes;
  }
  return result + ELLIPSIS;
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return typeof error === 'string' ? error : (JSON.stringify(error) ?? String(error));
}

export async function reportToPagerDeck(title: string, body: string): Promise<void> {
  if (!PAGERDECK_INGEST_KEY) {
    console.warn('PAGERDECK_INGEST_KEY is not configured, skipping PagerDeck report.');
    return;
  }

  try {
    const response = await fetch(PAGERDECK_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAGERDECK_INGEST_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: truncateBytes(title, MAX_TITLE_BYTES),
        body: truncateBytes(body, MAX_BODY_BYTES),
        severity: 'error',
        tags: ['prod', 'health-check'],
        dedup_key: DEDUP_KEY,
        ttl: TTL,
      }),
      signal: AbortSignal.timeout(PAGERDECK_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`Failed to report to PagerDeck: ${response.status} ${await response.text()}`);
      return;
    }
    console.log('Reported failure to PagerDeck.');
  } catch (error) {
    // Never let the alerting itself crash the health check
    console.error('Failed to report to PagerDeck:', error);
  }
}
