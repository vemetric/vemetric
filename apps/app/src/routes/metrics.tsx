import { createFileRoute } from '@tanstack/react-router';
import { clickhouseEvent } from 'clickhouse';
import { addDays } from 'date-fns';

let lastMetrics = {
  activeProjects: 0,
  eventsLast24h: 0,
};
let lastMetricsTimestamp: number | null = null;

async function updateMetrics() {
  const date30DaysAgo = addDays(new Date(), -30);

  lastMetrics = {
    activeProjects: await clickhouseEvent.getActiveProjectsCountSince(date30DaysAgo),
    eventsLast24h: await clickhouseEvent.getEventsCountAcrossAllProjects(),
  };
  lastMetricsTimestamp = Date.now();
}

updateMetrics();

export const Route = createFileRoute('/metrics')({
  server: {
    handlers: {
      GET: async () => {
        if (Date.now() - (lastMetricsTimestamp ?? 0) > 1000 * 60 * 10) {
          updateMetrics();
        }

        return Response.json(lastMetrics);
      },
    },
  },
});
