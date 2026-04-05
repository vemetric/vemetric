import { logger } from './backend-logger';

const MEMORY_REPORT_INTERVAL_MS = 12 * 60 * 60 * 1000;

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function getEventListenerCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of process.eventNames()) {
    counts[String(event)] = process.listenerCount(event);
  }
  return counts;
}

function logMemoryUsage() {
  const mem = process.memoryUsage();
  const resource = process.resourceUsage();

  logger.info(
    {
      rss: formatBytes(mem.rss),
      heapTotal: formatBytes(mem.heapTotal),
      heapUsed: formatBytes(mem.heapUsed),
      external: formatBytes(mem.external),
      arrayBuffers: formatBytes(mem.arrayBuffers),
      processEventListeners: getEventListenerCounts(),
      uptime: `${(process.uptime() / 3600).toFixed(1)}h`,
      maxRss: formatBytes(resource.maxRSS * 1024),
    },
    'Daily memory usage report',
  );
}

export function startMemoryReportSchedule() {
  logMemoryUsage();
  setInterval(logMemoryUsage, MEMORY_REPORT_INTERVAL_MS);
}
