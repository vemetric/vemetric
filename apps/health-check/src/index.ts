import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { Vemetric } from '@vemetric/node';
import { v4 as uuidv4 } from 'uuid';

// --- Configuration ---
// Use environment variables for configuration
const VEMETRIC_TOKEN: string | undefined = process.env.VEMETRIC_TOKEN;
const VEMETRIC_PROJECT_ID: string | undefined = process.env.VEMETRIC_PROJECT_ID;
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

// --- Main Health Check Logic ---
async function runHealthCheck(): Promise<void> {
  console.log('Starting health check...');

  // 1. Validate Configuration
  if (!VEMETRIC_TOKEN) {
    console.error('Error: VEMETRIC_TOKEN environment variable is not configured.');
    process.exit(1);
  }
  if (!VEMETRIC_PROJECT_ID) {
    console.error('Error: VEMETRIC_PROJECT_ID environment variable is not configured.');
    process.exit(1);
  }

  // 2. Initialize Vemetric SDK
  const vemetric = new Vemetric({
    token: VEMETRIC_TOKEN,
  });

  // 3. Generate unique token
  const healthCheckToken = uuidv4();
  console.log(`Generated health check token: ${healthCheckToken}`);

  // 4. Send event to Vemetric
  try {
    console.log(`Sending event "${HEALTH_CHECK_EVENT_NAME}" to Vemetric...`);
    await vemetric.trackEvent(HEALTH_CHECK_EVENT_NAME, {
      userIdentifier: 'health-checker',
      eventData: {
        healthCheckToken, // Include the token here
      },
    });
    console.log('Event sent successfully.');
  } catch (error) {
    console.error('Error sending event to Vemetric:', error);
    process.exit(1); // Exit with failure code
  }

  // 5. Wait for event propagation
  console.log(`Waiting ${CHECK_DELAY_MS / 1000} seconds for event propagation...`);
  await delay(CHECK_DELAY_MS);

  // 6. Initialize Clickhouse Client
  const clickhouseClient: ClickHouseClient = createClient({
    host: CLICKHOUSE_HOST,
    username: 'default',
    password: CLICKHOUSE_PASSWORD,
    database: 'vemetric',
    // Note: AbortSignal/timeout is handled per query below
  });

  // 7. Query Clickhouse for the event
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

    if (data?.data?.length > 0) {
      const rawCustomData = data.data[0].customData;
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
      console.error(`Error querying Clickhouse: Query timed out after ${QUERY_TIMEOUT_MS}ms.`);
    } else {
      console.error('Error querying Clickhouse:', error);
    }
    // Continue to verification, which will fail if data wasn't retrieved
  } finally {
    await clickhouseClient.close();
    console.log('Clickhouse connection closed.');
  }

  // 8. Verify the token
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
    console.error(`❌ Health check FAILED: Did not find event with token ${healthCheckToken} in Clickhouse.`);
    if (latestEventCustomData) {
      console.error('Last found custom data:', JSON.stringify(latestEventCustomData));
    }
    process.exit(1); // Exit with failure code
  }
}

// Run the check
runHealthCheck().catch((err) => {
  console.error('Unhandled error during health check:', err);
  process.exit(1);
});
