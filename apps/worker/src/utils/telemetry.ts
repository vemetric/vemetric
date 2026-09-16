import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { defaultQueueConnection } from '@vemetric/queues/queue-utils';
import { Queue } from 'bullmq';
import { BullMQOtel } from 'bullmq-otel';
import { logger } from './logger';

const axiomToken = process.env.AXIOM_TOKEN;
const axiomUrl = process.env.AXIOM_URL ?? 'https://api.axiom.co';
const METRICS_DATASET = process.env.AXIOM_DATASET_BULLMQ ?? 'vemetric-bullmq';
const METRICS_INTERVAL_MS = 60_000;

let sdk: NodeSDK | undefined;
let metricsTimer: ReturnType<typeof setInterval> | undefined;
let metricsQueues: Queue[] = [];

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
  logger.info(
    { metricsDataset: METRICS_DATASET, metricsIntervalMs: METRICS_INTERVAL_MS },
    'BullMQ telemetry exporting to Axiom',
  );
}

export const queueTelemetry = new BullMQOtel({
  tracerName: 'vemetric-bullmq',
  meterName: 'vemetric-bullmq',
  enableMetrics: true,
});

/**
 * Periodically records the `bullmq.queue.jobs` gauge (job counts per state) for the given queues.
 * BullMQ only emits this gauge when `recordJobCountsMetric` is called explicitly, and the gauge
 * lives on `Queue` (unlike the job counters, which the workers emit themselves).
 */
export function startQueueMetricsRecorder(queueNames: string[]) {
  if (!sdk || queueNames.length === 0) {
    return;
  }

  metricsQueues = queueNames.map(
    (name) => new Queue(name, { connection: defaultQueueConnection, telemetry: queueTelemetry }),
  );

  const record = () => {
    Promise.all(metricsQueues.map((queue) => queue.recordJobCountsMetric())).catch((err) => {
      logger.error({ err }, 'Failed to record queue job counts metrics');
    });
  };

  record();
  metricsTimer = setInterval(record, METRICS_INTERVAL_MS);
}

export async function shutdownQueueTelemetry() {
  if (metricsTimer) {
    clearInterval(metricsTimer);
    metricsTimer = undefined;
  }

  await Promise.all(metricsQueues.map((queue) => queue.close()));
  metricsQueues = [];

  if (sdk) {
    await sdk.shutdown().catch((err) => logger.error({ err }, 'Failed to shutdown queue telemetry'));
  }
}
