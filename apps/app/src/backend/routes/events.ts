import { filterConfigSchema } from '@vemetric/common/filters';
import { clickhouseEvent } from 'clickhouse';
import { z } from 'zod';
import {router, timespanProcedure } from '../utils/trpc';

const EVENTS_PER_PAGE = 50;

export const eventsRouter = router({
  list: timespanProcedure
    .input(
      z.object({
        cursor: z.string().optional(), // ISO timestamp string
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { projectId, startDate, endDate } = ctx;

      const limit = EVENTS_PER_PAGE + 1; // Get one extra to determine if there are more

      // Get paginated events with cursor-based filtering
      const events = await clickhouseEvent.getLatestEventsByProjectId({
        projectId,
        limit,
        cursor: input.cursor, // Used to fetch events before this timestamp
        filterConfig: input.filterConfig,
        startDate,
        endDate,
      });

      const hasMore = events.length > EVENTS_PER_PAGE;
      const latestEvents = hasMore ? events.slice(0, -1) : events;

      return {
        events: latestEvents.map((event) => ({
          ...event,
          userId: String(event.userId),
          projectId: String(event.projectId),
        })),
        nextCursor: hasMore ? latestEvents[latestEvents.length - 1].createdAt : undefined,
      };
    }),
});
