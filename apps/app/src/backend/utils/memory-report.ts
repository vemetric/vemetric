import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from './backend-logger';

type RouteGroup = 'auth' | 'page' | 'public_api' | 'static' | 'trpc' | 'other';
type RouteResolution = {
  routeGroup: RouteGroup;
  routeSubgroup: string;
};

type RouteGroupStats = {
  requests: number;
  errors: number;
  inflight: number;
  inflightMax: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
  totalRequestBytes: number;
  maxRequestBytes: number;
  totalResponseBytes: number;
  maxResponseBytes: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
};

type MemorySnapshot = ReturnType<typeof collectMemorySnapshot>;

const MEMORY_REPORT_INTERVAL_MS = Number(process.env.MEMORY_REPORT_INTERVAL_MS ?? 60 * 60 * 1000);
const RSS_THRESHOLDS_MB = (process.env.MEMORY_REPORT_RSS_THRESHOLDS_MB ?? '1024,1536,2048')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0)
  .sort((left, right) => left - right);

const STATIC_FILE_EXTENSIONS = [
  '.js',
  '.css',
  '.map',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.txt',
  '.xml',
  '.json',
  '.webmanifest',
  '.pdf',
  '.mp4',
  '.webm',
];

let telemetryInitialized = false;
let lastMemorySnapshot: MemorySnapshot | null = null;
let maxInflightInInterval = 0;
let globalInflight = 0;
const triggeredThresholds = new Set<number>();
let routeGroupStats = createEmptyStatsMap();
let routeSubgroupStats = new Map<string, RouteGroupStats>();

function createEmptyStats(): RouteGroupStats {
  return {
    requests: 0,
    errors: 0,
    inflight: 0,
    inflightMax: 0,
    totalLatencyMs: 0,
    maxLatencyMs: 0,
    totalRequestBytes: 0,
    maxRequestBytes: 0,
    totalResponseBytes: 0,
    maxResponseBytes: 0,
    status2xx: 0,
    status3xx: 0,
    status4xx: 0,
    status5xx: 0,
  };
}

function createEmptyStatsMap(): Record<RouteGroup, RouteGroupStats> {
  return {
    auth: createEmptyStats(),
    page: createEmptyStats(),
    public_api: createEmptyStats(),
    static: createEmptyStats(),
    trpc: createEmptyStats(),
    other: createEmptyStats(),
  };
}

function toMb(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(1));
}

function getEventListenerCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of process.eventNames()) {
    counts[String(event)] = process.listenerCount(event);
  }
  return counts;
}

function collectMemorySnapshot() {
  const mem = process.memoryUsage();
  const resource = process.resourceUsage();

  return {
    rssMb: toMb(mem.rss),
    heapTotalMb: toMb(mem.heapTotal),
    heapUsedMb: toMb(mem.heapUsed),
    externalMb: toMb(mem.external),
    arrayBuffersMb: toMb(mem.arrayBuffers),
    maxRssMb: toMb(resource.maxRSS * 1024),
    uptimeHours: Number((process.uptime() / 3600).toFixed(1)),
    processEventListeners: getEventListenerCounts(),
  };
}

function getDelta(current: MemorySnapshot, previous: MemorySnapshot | null) {
  if (!previous) {
    return {
      rssMb: 0,
      heapTotalMb: 0,
      heapUsedMb: 0,
      externalMb: 0,
      arrayBuffersMb: 0,
    };
  }

  return {
    rssMb: Number((current.rssMb - previous.rssMb).toFixed(1)),
    heapTotalMb: Number((current.heapTotalMb - previous.heapTotalMb).toFixed(1)),
    heapUsedMb: Number((current.heapUsedMb - previous.heapUsedMb).toFixed(1)),
    externalMb: Number((current.externalMb - previous.externalMb).toFixed(1)),
    arrayBuffersMb: Number((current.arrayBuffersMb - previous.arrayBuffersMb).toFixed(1)),
  };
}

function incrementStatus(stats: RouteGroupStats, status: number) {
  if (status >= 500) {
    stats.status5xx += 1;
  } else if (status >= 400) {
    stats.status4xx += 1;
  } else if (status >= 300) {
    stats.status3xx += 1;
  } else if (status >= 200) {
    stats.status2xx += 1;
  }
}

function getOrCreateSubgroupStats(routeSubgroup: string) {
  const existing = routeSubgroupStats.get(routeSubgroup);
  if (existing) {
    return existing;
  }

  const stats = createEmptyStats();
  routeSubgroupStats.set(routeSubgroup, stats);
  return stats;
}

function resolveTrpcSubgroup(path: string) {
  const procedurePath = path.replace(/^\/_api\/trpc\/?/, '');
  if (!procedurePath) {
    return 'trpc.unknown';
  }

  const namespaces = Array.from(
    new Set(
      procedurePath
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.split('.')[0] || 'root'),
    ),
  );

  if (namespaces.length === 0) {
    return 'trpc.unknown';
  }

  if (namespaces.length > 1) {
    return 'trpc.mixed';
  }

  return `trpc.${namespaces[0]}`;
}

function resolveRoute(method: string, path: string, acceptHeader?: string | null): RouteResolution {
  if (path.startsWith('/_api/trpc')) {
    return {
      routeGroup: 'trpc',
      routeSubgroup: resolveTrpcSubgroup(path),
    };
  }

  if (path.startsWith('/_api/auth')) {
    return {
      routeGroup: 'auth',
      routeSubgroup: 'auth',
    };
  }

  if (path === '/api' || path === '/api/' || path.startsWith('/api/')) {
    return {
      routeGroup: 'public_api',
      routeSubgroup: 'public_api',
    };
  }

  if (
    path.startsWith('/assets/') ||
    path.startsWith('/workbox-') ||
    path === '/favicon.ico' ||
    path === '/robots.txt' ||
    path === '/manifest.webmanifest' ||
    path === '/sw.js' ||
    STATIC_FILE_EXTENSIONS.some((extension) => path.endsWith(extension))
  ) {
    return {
      routeGroup: 'static',
      routeSubgroup: 'static',
    };
  }

  const normalizedAccept = acceptHeader?.toLowerCase() ?? '';
  if ((method === 'GET' || method === 'HEAD') && normalizedAccept.includes('text/html')) {
    return {
      routeGroup: 'page',
      routeSubgroup: 'page',
    };
  }

  return {
    routeGroup: 'other',
    routeSubgroup: 'other',
  };
}

function readByteCount(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function logInterval() {
  try {
    const memory = collectMemorySnapshot();
    const memoryDelta = getDelta(memory, lastMemorySnapshot);

    logger.info(
      {
        type: 'memory.interval',
        appName: 'vemetric-backend',
        hostname: process.env.HOSTNAME,
        windowSeconds: Math.round(MEMORY_REPORT_INTERVAL_MS / 1000),
        memory,
        memoryDeltaSinceLastInterval: memoryDelta,
        inflightCurrent: globalInflight,
        inflightMaxInInterval: maxInflightInInterval,
      },
      'Memory telemetry interval',
    );

    for (const [routeGroup, stats] of Object.entries(routeGroupStats) as [RouteGroup, RouteGroupStats][]) {
      if (stats.requests === 0) {
        continue;
      }

      logger.info(
        {
          type: 'memory.route_group',
          appName: 'vemetric-backend',
          hostname: process.env.HOSTNAME,
          routeGroup,
          windowSeconds: Math.round(MEMORY_REPORT_INTERVAL_MS / 1000),
          requests: stats.requests,
          errors: stats.errors,
          inflightMax: stats.inflightMax,
          avgLatencyMs: Number((stats.totalLatencyMs / stats.requests).toFixed(1)),
          maxLatencyMs: Number(stats.maxLatencyMs.toFixed(1)),
          avgRequestBytes: Math.round(stats.totalRequestBytes / stats.requests),
          maxRequestBytes: stats.maxRequestBytes,
          avgResponseBytes: Math.round(stats.totalResponseBytes / stats.requests),
          maxResponseBytes: stats.maxResponseBytes,
          status2xx: stats.status2xx,
          status3xx: stats.status3xx,
          status4xx: stats.status4xx,
          status5xx: stats.status5xx,
          rssMb: memory.rssMb,
          heapUsedMb: memory.heapUsedMb,
          externalMb: memory.externalMb,
          arrayBuffersMb: memory.arrayBuffersMb,
        },
        'Memory telemetry route group',
      );
    }

    for (const [routeSubgroup, stats] of Array.from(routeSubgroupStats.entries())) {
      if (stats.requests === 0) {
        continue;
      }

      logger.info(
        {
          type: 'memory.route_subgroup',
          appName: 'vemetric-backend',
          hostname: process.env.HOSTNAME,
          routeSubgroup,
          routeGroup: routeSubgroup.startsWith('trpc.') ? 'trpc' : routeSubgroup,
          windowSeconds: Math.round(MEMORY_REPORT_INTERVAL_MS / 1000),
          requests: stats.requests,
          errors: stats.errors,
          inflightMax: stats.inflightMax,
          avgLatencyMs: Number((stats.totalLatencyMs / stats.requests).toFixed(1)),
          maxLatencyMs: Number(stats.maxLatencyMs.toFixed(1)),
          avgRequestBytes: Math.round(stats.totalRequestBytes / stats.requests),
          maxRequestBytes: stats.maxRequestBytes,
          avgResponseBytes: Math.round(stats.totalResponseBytes / stats.requests),
          maxResponseBytes: stats.maxResponseBytes,
          status2xx: stats.status2xx,
          status3xx: stats.status3xx,
          status4xx: stats.status4xx,
          status5xx: stats.status5xx,
          rssMb: memory.rssMb,
          heapUsedMb: memory.heapUsedMb,
          externalMb: memory.externalMb,
          arrayBuffersMb: memory.arrayBuffersMb,
        },
        'Memory telemetry route subgroup',
      );
    }

    for (const thresholdMb of RSS_THRESHOLDS_MB) {
      if (memory.rssMb < thresholdMb || triggeredThresholds.has(thresholdMb)) {
        continue;
      }

      triggeredThresholds.add(thresholdMb);
      logger.warn(
        {
          type: 'memory.threshold',
          appName: 'vemetric-backend',
          hostname: process.env.HOSTNAME,
          thresholdMb,
          memory,
          memoryDeltaSinceLastInterval: memoryDelta,
          inflightCurrent: globalInflight,
          inflightMaxInInterval: maxInflightInInterval,
        },
        'Memory telemetry threshold reached',
      );
    }

    lastMemorySnapshot = memory;
  } catch (error) {
    logger.error({ err: error }, 'Memory telemetry interval failed');
  } finally {
    maxInflightInInterval = globalInflight;
    routeGroupStats = createEmptyStatsMap();
    routeSubgroupStats = new Map<string, RouteGroupStats>();
  }
}

export const memoryTelemetryMiddleware: MiddlewareHandler = async (c: Context, next) => {
  const { routeGroup, routeSubgroup } = resolveRoute(c.req.method, c.req.path, c.req.header('accept'));
  const groupStats = routeGroupStats[routeGroup];
  const subgroupStats = getOrCreateSubgroupStats(routeSubgroup);
  const start = performance.now();
  const requestBytes = readByteCount(c.req.header('content-length'));

  try {
    globalInflight += 1;
    maxInflightInInterval = Math.max(maxInflightInInterval, globalInflight);
    groupStats.inflight += 1;
    groupStats.inflightMax = Math.max(groupStats.inflightMax, groupStats.inflight);
    subgroupStats.inflight += 1;
    subgroupStats.inflightMax = Math.max(subgroupStats.inflightMax, subgroupStats.inflight);
  } catch (error) {
    logger.error({ err: error, path: c.req.path, method: c.req.method }, 'Memory telemetry middleware failed');
  }

  let status = 200;
  try {
    await next();
    status = c.res.status;
  } catch (error) {
    if (error instanceof HTTPException) {
      status = error.status;
    } else {
      status = 500;
    }
    throw error;
  } finally {
    try {
      const latencyMs = performance.now() - start;
      const responseBytes = readByteCount(c.res.headers.get('content-length'));

      for (const stats of [groupStats, subgroupStats]) {
        stats.requests += 1;
        stats.totalLatencyMs += latencyMs;
        stats.maxLatencyMs = Math.max(stats.maxLatencyMs, latencyMs);
        stats.totalRequestBytes += requestBytes;
        stats.maxRequestBytes = Math.max(stats.maxRequestBytes, requestBytes);
        stats.totalResponseBytes += responseBytes;
        stats.maxResponseBytes = Math.max(stats.maxResponseBytes, responseBytes);
        incrementStatus(stats, status);
      }

      if (status >= 500) {
        groupStats.errors += 1;
        subgroupStats.errors += 1;
      }
    } catch (error) {
      logger.error(
        { err: error, path: c.req.path, method: c.req.method },
        'Memory telemetry request accounting failed',
      );
    } finally {
      groupStats.inflight = Math.max(0, groupStats.inflight - 1);
      subgroupStats.inflight = Math.max(0, subgroupStats.inflight - 1);
      globalInflight = Math.max(0, globalInflight - 1);
    }
  }
};

export function startMemoryReportSchedule() {
  if (telemetryInitialized) {
    return;
  }

  telemetryInitialized = true;

  logger.info(
    {
      type: 'memory.telemetry.started',
      appName: 'vemetric-backend',
      hostname: process.env.HOSTNAME,
      intervalMs: MEMORY_REPORT_INTERVAL_MS,
      rssThresholdsMb: RSS_THRESHOLDS_MB,
    },
    'Memory telemetry started',
  );

  logInterval();
  setInterval(logInterval, MEMORY_REPORT_INTERVAL_MS);
}
