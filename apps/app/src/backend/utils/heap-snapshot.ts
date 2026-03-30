import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { logger } from './backend-logger';

const HEAP_SNAPSHOT_DIR =
  process.env.HEAP_SNAPSHOT_DIR || '/tmp/heap-snapshots';
const HEAP_SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function logMemoryUsage() {
  const mem = process.memoryUsage();
  logger.info(
    {
      rss: formatBytes(mem.rss),
      heapTotal: formatBytes(mem.heapTotal),
      heapUsed: formatBytes(mem.heapUsed),
      external: formatBytes(mem.external),
      arrayBuffers: formatBytes(mem.arrayBuffers),
    },
    'Daily memory usage report',
  );
}

function takeHeapSnapshot() {
  try {
    logMemoryUsage();

    if (!existsSync(HEAP_SNAPSHOT_DIR)) {
      mkdirSync(HEAP_SNAPSHOT_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `${HEAP_SNAPSHOT_DIR}/heap-${timestamp}.heapsnapshot`;
    const snapshot = Bun.generateHeapSnapshot('v8');
    writeFileSync(filePath, snapshot);
    logger.info({ path: filePath }, 'Heap snapshot saved');
  } catch (err) {
    logger.error({ err }, 'Failed to take heap snapshot');
  }
}

export function startHeapSnapshotSchedule() {
  takeHeapSnapshot();
  setInterval(takeHeapSnapshot, HEAP_SNAPSHOT_INTERVAL_MS);
}
