import { metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { defaultQueueConnection } from '@vemetric/queues/queue-utils';
import { Queue } from 'bullmq';
import { BullMQOtel } from 'bullmq-otel';
import { logger } from './logger';
import { pendingSessionStats } from '../ingestion/session-flush';

const axiomToken = process.env.AXIOM_TOKEN;
const axiomUrl = process.env.AXIOM_URL ?? 'https://api.axiom.co';
const METRICS_DATASET = process.env.AXIOM_DATASET_BULLMQ ?? 'vemetric-bullmq';
export const METRICS_INTERVAL_MS = 60_000;

let sdk: NodeSDK | undefined;
let recordedQueues: Queue[] = [];

if (axiomToken) {
  sdk = new NodeSDK({
    // Without an explicit exporter, NodeSDK falls back to an OTLP trace exporter configured
    // via OTEL_* env vars. An empty span processor list keeps the trace pipeline disabled
    // so only metrics are recorded/exported.
    spanProcessors: [],
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${axiomUrl}/v1/metrics`,
          headers: {
            Authorization: `Bearer ${axiomToken}`,
            'X-Axiom-Metrics-Dataset': METRICS_DATASET,
          },
        }),
        exportIntervalMillis: METRICS_INTERVAL_MS,
      }),
    ],
  });

  sdk.start();
  registerIngestionGauges();
  logger.info(
    { metricsDataset: METRICS_DATASET, metricsIntervalMs: METRICS_INTERVAL_MS },
    'BullMQ telemetry exporting to Axiom',
  );
}

/**
 * Pending session snapshots and the age of the oldest one. Every replica reports the same
 * Redis-wide values, so aggregate them with max. A growing age means the flusher is not
 * writing sessions to ClickHouse.
 */
function registerIngestionGauges() {
  const meter = metrics.getMeter('vemetric-ingestion');
  const pending = meter.createObservableGauge('vemetric.sessions.pending', {
    description: 'Session snapshots waiting to be written to ClickHouse',
  });
  const oldestAge = meter.createObservableGauge('vemetric.sessions.pending_oldest_age', {
    description: 'Seconds the oldest pending session snapshot has been waiting',
    unit: 's',
  });
  meter.addBatchObservableCallback(
    async (result) => {
      try {
        const stats = await pendingSessionStats();
        result.observe(pending, stats.count);
        result.observe(oldestAge, stats.oldestAgeSeconds);
      } catch (err) {
        logger.error({ err }, 'Failed to read pending session metrics');
      }
    },
    [pending, oldestAge],
  );
}

export const queueTelemetry = new BullMQOtel({
  tracerName: 'vemetric-bullmq',
  meterName: 'vemetric-bullmq',
  enableMetrics: true,
});

/**
 * Records the `bullmq.queue.jobs` gauge (job counts per state) for the given queues.
 * BullMQ only emits this gauge when `recordJobCountsMetric` is called explicitly, and the
 * gauge lives on `Queue` (unlike the job counters, which the workers emit themselves).
 * The counts cover the entire queue, so this must be invoked by a single recorder; that is
 * coordinated by the scheduled job in `workers/metrics-worker.ts`.
 */
export async function recordQueueJobCounts(queueNames: string[]) {
  if (!sdk || queueNames.length === 0) {
    return;
  }

  if (recordedQueues.length === 0) {
    recordedQueues = queueNames.map(
      (name) => new Queue(name, { connection: defaultQueueConnection, telemetry: queueTelemetry }),
    );
  }

  await Promise.all(recordedQueues.map((queue) => queue.recordJobCountsMetric()));
}

export async function shutdownQueueTelemetry() {
  await Promise.all(recordedQueues.map((queue) => queue.close()));
  recordedQueues = [];

  if (sdk) {
    await sdk.shutdown().catch((err) => logger.error({ err }, 'Failed to shutdown queue telemetry'));
  }
}
