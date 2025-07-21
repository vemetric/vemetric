import { clickhouseEvent } from 'clickhouse';
import { dbProject } from 'database';
import type { Hono } from 'hono';
import type { HonoContextVars } from '../types';

let lastMetrics = {
  activeProjects: 0,
  eventsLast24h: 0,
};
let lastMetricsTimestamp: number | null = null;

async function updateMetrics() {
  lastMetrics = {
    activeProjects: await dbProject.countActive(),
    eventsLast24h: await clickhouseEvent.getEventsCountAcrossAllProjects(),
  };
  lastMetricsTimestamp = Date.now();
}
updateMetrics();

export async function useLandingPageMetrics(app: Hono<{ Variables: HonoContextVars }>) {
  app.get('/metrics', async ({ json }) => {
    if (Date.now() - (lastMetricsTimestamp ?? 0) > 1000 * 60 * 10) {
      updateMetrics();
    }

    return json(lastMetrics);
  });
}
