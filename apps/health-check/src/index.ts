import { createClient, type ClickHouseClient } from '@clickhouse/client-web';
import { v4 as uuidv4 } from 'uuid';
import { formatError, reportToPagerDeck } from './pagerdeck';

// --- Configuration ---
// Use environment variables for configuration
const VEMETRIC_TOKEN: string | undefined = process.env.VEMETRIC_TOKEN;
const VEMETRIC_PROJECT_ID: string | undefined = process.env.VEMETRIC_PROJECT_ID;
const VEMETRIC_HUB_URL: string = process.env.VEMETRIC_HUB_URL ?? 'https://hub.vemetric.com';
const CLICKHOUSE_HOST: string = process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123';
const CLICKHOUSE_PASSWORD: string = process.env.CLICKHOUSE_PASSWORD ?? '';

const HEALTH_CHECK_EVENT_NAME: string = 'HealthCheck';
const CHECK_DELAY_MS: number = parseInt(process.env.CHECK_DELAY_MS ?? '5000', 10); // Wait 5 seconds default
const QUERY_TIMEOUT_MS: number = parseInt(process.env.QUERY_TIMEOUT_MS ?? '10000', 10); // 10 seconds default

// --- Type Definitions ---
interface ClickhouseEventRow {
  customData: string | Record<string, unknown>; // Adjust based on how Clickhouse returns JSON/String
}

interface ExpectedCustomData {
  healthCheckToken: string;
  // Add other expected fields if necessary
}

// --- Helper Function ---
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Logs the failure, reports it to PagerDeck and exits with a failure code
async function fail(title: string, details: string): Promise<never> {
  console.error(`${title}\n${details}`);
  await reportToPagerDeck(title, details);
  process.exit(1);
}

// --- Main Health Check Logic ---
async function runHealthCheck(): Promise<void> {
  console.log('Starting health check...');

  // 1. Validate Configuration
  if (!VEMETRIC_TOKEN) {
    return fail('Health check misconfigured', 'VEMETRIC_TOKEN environment variable is not configured.');
  }
  if (!VEMETRIC_PROJECT_ID) {
    return fail('Health check misconfigured', 'VEMETRIC_PROJECT_ID environment variable is not configured.');
  }

  // 2. Generate unique token
  const healthCheckToken = uuidv4();
  console.log(`Generated health check token: ${healthCheckToken}`);

  // 3. Send event to the Vemetric hub
  // Not using the @vemetric/node SDK here, as it swallows request errors and we want to know if the hub is down
  let sendError: string | null = null;
  try {
    console.log(`Sending event "${HEALTH_CHECK_EVENT_NAME}" to ${VEMETRIC_HUB_URL}...`);
    const response = await fetch(`${VEMETRIC_HUB_URL}/e`, {
      method: 'POST',
      headers: {
        Token: VEMETRIC_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: HEALTH_CHECK_EVENT_NAME,
        userIdentifier: 'health-checker',
        customData: {
          healthCheckToken, // Include the token here
        },
      }),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });
    if (!response.ok) {
      sendError = `Hub responded with ${response.status} ${await response.text()}`;
    }
  } catch (error) {
    sendError = formatError(error);
  }
  if (sendError) {
    await fail('Health check FAILED: could not send event to the hub', sendError);
  }
  console.log('Event sent successfully.');

  // 4. Wait for event propagation
  console.log(`Waiting ${CHECK_DELAY_MS / 1000} seconds for event propagation...`);
  await delay(CHECK_DELAY_MS);

  // 5. Initialize Clickhouse Client
  const clickhouseClient: ClickHouseClient = createClient({
    host: CLICKHOUSE_HOST,
    username: 'default',
    password: CLICKHOUSE_PASSWORD,
    database: 'vemetric',
    // Note: AbortSignal/timeout is handled per query below
  });

  // 6. Query Clickhouse for the event
  let clickhouseError: string | null = null;
  let latestEventCustomData: ExpectedCustomData | null | { raw: unknown } = null;
  try {
    console.log('Querying Clickhouse for the latest event...');

    const query = `
      SELECT customData
      FROM event
      WHERE projectId = {projectId: String} AND name = {eventName: String}
      ORDER BY createdAt DESC
      LIMIT 1
    `;

    const resultSet = await clickhouseClient.query({
      query: query,
      query_params: {
        projectId: VEMETRIC_PROJECT_ID,
        eventName: HEALTH_CHECK_EVENT_NAME,
      },
    });

    // Type assertion for the expected structure
    const data = await resultSet.json<ClickhouseEventRow>();
    const rows = Array.isArray(data)
      ? data
      : 'data' in data && Array.isArray(data.data)
        ? data.data
        : Object.values(data);

    if (rows.length > 0) {
      const rawCustomData = rows[0].customData;
      console.log('Raw customData from Clickhouse:', rawCustomData);

      // Adapt parsing based on how customData is stored and returned
      if (typeof rawCustomData === 'string') {
        try {
          latestEventCustomData = JSON.parse(rawCustomData) as ExpectedCustomData;
        } catch (parseError) {
          console.error('Failed to parse customData JSON string:', parseError);
          latestEventCustomData = { raw: rawCustomData }; // Store raw if parsing fails
        }
      } else if (typeof rawCustomData === 'object' && rawCustomData !== null) {
        // If Clickhouse returns it as an object directly
        latestEventCustomData = rawCustomData as unknown as ExpectedCustomData;
      } else {
        console.warn('Received unexpected format for customData:', rawCustomData);
        latestEventCustomData = { raw: rawCustomData };
      }

      console.log('Parsed custom data:', latestEventCustomData);
    } else {
      console.log('No matching event found in Clickhouse yet.');
    }
  } catch (error) {
    // Check if it's an AbortError (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      clickhouseError = `Query timed out after ${QUERY_TIMEOUT_MS}ms.`;
    } else {
      clickhouseError = formatError(error);
    }
    // Continue to verification, which will fail if data wasn't retrieved
  } finally {
    await clickhouseClient.close();
    console.log('Clickhouse connection closed.');
  }

  // 7. Verify the token
  // Type guard to ensure latestEventCustomData has the expected structure
  if (
    latestEventCustomData &&
    typeof latestEventCustomData === 'object' &&
    'healthCheckToken' in latestEventCustomData &&
    latestEventCustomData.healthCheckToken === healthCheckToken
  ) {
    console.log('✅ Health check PASSED: Found event with matching token in Clickhouse.');
    process.exit(0); // Exit with success code
  } else {
    const details = [`Did not find event with token ${healthCheckToken} in Clickhouse.`];
    if (clickhouseError) {
      details.push(`Error querying Clickhouse: ${clickhouseError}`);
    }
    if (latestEventCustomData) {
      details.push(`Last found custom data: ${JSON.stringify(latestEventCustomData)}`);
    }
    await fail('❌ Health check FAILED: event not found in Clickhouse', details.join('\n'));
  }
}

// Run the check
runHealthCheck().catch((err) => fail('Health check FAILED: unhandled error', formatError(err)));
