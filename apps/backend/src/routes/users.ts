import { filterConfigSchema } from '@vemetric/common/filters';
import { userSortConfigSchema } from '@vemetric/common/sort';
import type { ClickhouseEvent } from 'clickhouse';
import { clickhouseEvent, clickhouseSession, clickhouseUser, getUserFilterQueries } from 'clickhouse';
import { addDays, addMonths, startOfDay } from 'date-fns';
import { z } from 'zod';
import { projectProcedure, router } from '../utils/trpc';

const EVENTS_PER_PAGE = 50;
const USERS_PER_PAGE = 50;

const getFreePlanStartDate = (isSubscriptionActive: boolean) =>
  isSubscriptionActive ? undefined : addDays(startOfDay(new Date()), -30);

export const usersRouter = router({
  list: projectProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        filterConfig: filterConfigSchema,
        sortConfig: userSortConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { page, filterConfig, sortConfig },
        ctx: { projectId, project, subscriptionStatus },
      } = opts;

      const startDate = getFreePlanStartDate(subscriptionStatus.isActive);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate });

      const offset = (page - 1) * USERS_PER_PAGE;
      const [users] = await Promise.all([
        clickhouseEvent.getLatestUsers(
          projectId,
          {
            offset,
            limit: USERS_PER_PAGE + 1, // Get one extra to determine if there are more
          },
          filterQueries,
          filterConfig,
          sortConfig,
          startDate,
        ),
      ]);

      const hasNextPage = users.length > USERS_PER_PAGE;
      const paginatedUsers = hasNextPage ? users.slice(0, -1) : users;
      const isInitialized = users.length > 0 || (await clickhouseEvent.getAllEventsCount(projectId)) > 0;

      return {
        projectToken: project.token,
        users: paginatedUsers.map((user) => ({ ...user, id: String(user.id) })),
        hasNextPage,
        isInitialized,
      };
    }),
  identifier: projectProcedure.input(z.object({ identifier: z.string() })).query(async (opts) => {
    const {
      input: { identifier },
      ctx: { projectId },
    } = opts;

    const user = await clickhouseUser.findByIdentifier(projectId, identifier);

    return { userId: user?.id };
  }),
  single: projectProcedure.input(z.object({ userId: z.string() })).query(async (opts) => {
    const {
      input,
      ctx: { projectId },
    } = opts;

    const userId = BigInt(input.userId);

    const latestEvent: (ClickhouseEvent & { isOnline: boolean }) | null =
      (await clickhouseEvent.getLatestEventsByUserId({ projectId, userId, limit: 1 }))[0] ?? null;

    const user = await clickhouseUser.findById(projectId, userId);

    return {
      latestEvent,
      user: user ? { ...user, id: String(user.id) } : null,
    };
  }),
  events: projectProcedure
    .input(
      z.object({
        userId: z.string(),
        cursor: z.string().optional(), // ISO timestamp string
        date: z.string().optional(), // YYYY-MM-DD format
      }),
    )
    .query(async (opts) => {
      const {
        input,
        ctx: { projectId, subscriptionStatus },
      } = opts;

      const userId = BigInt(input.userId);
      const limit = EVENTS_PER_PAGE + 1; // Get one extra to determine if there are more

      const startDate = getFreePlanStartDate(subscriptionStatus.isActive);

      // Get paginated events
      const events = await clickhouseEvent.getLatestEventsByUserId({
        projectId,
        userId,
        limit,
        cursor: input.cursor,
        startDate,
        date: input.date,
      });

      const hasMore = events.length > EVENTS_PER_PAGE;
      const latestEvents = hasMore ? events.slice(0, -1) : events;

      // Get sessions for these events
      const sessionIds = new Set(latestEvents.map((event) => event.sessionId));
      const sessions = sessionIds.size > 0 ? await clickhouseSession.findByIds(projectId, userId, sessionIds) : [];

      return {
        startDate,
        events: latestEvents,
        sessions,
        nextCursor: hasMore ? latestEvents[latestEvents.length - 1].createdAt : undefined,
        isNextEventSameSession: hasMore
          ? events[events.length - 1].sessionId === events[events.length - 2].sessionId
          : false,
      };
    }),
  activityHeatmap: projectProcedure.input(z.object({ userId: z.string() })).query(async (opts) => {
    const {
      input: { userId },
      ctx: { projectId, subscriptionStatus },
    } = opts;

    const startDate = getFreePlanStartDate(subscriptionStatus.isActive) ?? addMonths(new Date(), -6);

    // Get event counts for each day in the last 6 months
    const events = await clickhouseEvent.getEventCountsByDay({
      projectId,
      userId: BigInt(userId),
      startDate,
    });

    // Create a map of dates to event counts
    const eventMap = new Map<string, number>();
    events.forEach((event) => {
      eventMap.set(event.createdAt, event.count);
    });

    return { startDate, eventMap: Object.fromEntries(eventMap) };
  }),
});
