import { isEntityUnknown } from '@vemetric/common/event';
import { filterConfigSchema } from '@vemetric/common/filters';
import type { FunnelStep } from '@vemetric/common/funnel';
import { userSortConfigSchema } from '@vemetric/common/sort';
import type { ClickhouseEvent } from 'clickhouse';
import { clickhouseEvent, clickhouseSession, clickhouseUser, getUserFilterQueries } from 'clickhouse';
import { dbFunnel } from 'database';
import { addDays, addMonths, startOfDay } from 'date-fns';
import { z } from 'zod';
import { getFilterFunnelsData } from '../utils/filter';
import { projectProcedure, router } from '../trpc';

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
        search: z.string().optional(),
      }),
    )
    .query(async (opts) => {
      const {
        input: { page, filterConfig, sortConfig, search },
        ctx: { projectId, project, subscriptionStatus },
      } = opts;

      const startDate = getFreePlanStartDate(subscriptionStatus.isActive);
      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, funnelsData });

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
          search,
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

    const [latestEvents, user] = await Promise.all([
      clickhouseEvent.getLatestEventsByUserId({ projectId, userId, limit: 1 }),
      clickhouseUser.findById(projectId, userId, true),
    ]);

    const latestEvent: (ClickhouseEvent & { isOnline: boolean }) | null = latestEvents[0] ?? null;

    const deviceData = {
      clientName: isEntityUnknown(latestEvent?.clientName)
        ? user?.device?.clientName || 'Unknown'
        : latestEvent?.clientName || 'Unknown',
      clientVersion: isEntityUnknown(latestEvent?.clientVersion)
        ? user?.device?.clientVersion || 'Unknown'
        : latestEvent?.clientVersion || 'Unknown',
      osName: isEntityUnknown(latestEvent?.osName)
        ? user?.device?.osName || 'Unknown'
        : latestEvent?.osName || 'Unknown',
      osVersion: isEntityUnknown(latestEvent?.osVersion)
        ? user?.device?.osVersion || 'Unknown'
        : latestEvent?.osVersion || 'Unknown',
      deviceType: isEntityUnknown(latestEvent?.deviceType)
        ? user?.device?.deviceType || 'unknown'
        : latestEvent?.deviceType || 'unknown',
    };

    return {
      latestEvent,
      user: user
        ? { ...user, id: String(user.id), displayName: user.displayName || latestEvent.userDisplayName }
        : null,
      deviceData,
    };
  }),
  events: projectProcedure
    .input(
      z.object({
        userId: z.string(),
        cursor: z.string().optional(), // ISO timestamp string
        date: z.string().optional(), // YYYY-MM-DD format
        filterConfig: filterConfigSchema,
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
        filterConfig: input.filterConfig,
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
  funnelProgress: projectProcedure
    .input(z.object({ projectId: z.string(), userId: z.string() }))
    .query(async (opts) => {
      const {
        input: { userId },
        ctx: { projectId, project, subscriptionStatus },
      } = opts;

      const startDate = getFreePlanStartDate(subscriptionStatus.isActive);

      // Get all funnels for the project
      const funnels = await dbFunnel.findByProjectId(project.id);

      if (funnels.length === 0) {
        return { funnelsData: [] };
      }

      // Get user's funnel progress
      const funnelProgress = await clickhouseEvent.getUserFunnelProgress(
        projectId,
        BigInt(userId),
        funnels.map((funnel) => ({
          id: funnel.id,
          name: funnel.name,
          steps: funnel.steps as FunnelStep[],
        })),
        startDate,
      );

      // Prepare all funnels data with progress information
      const funnelsData = funnels.map((funnel) => {
        const progress = funnelProgress.find((p) => p.funnelId === funnel.id);
        return {
          funnelId: funnel.id,
          funnelName: funnel.name,
          funnelIcon: funnel.icon,
          completedStep: progress?.completedStep || 0,
          totalSteps: (funnel.steps as FunnelStep[]).length,
        };
      });

      return { funnelsData };
    }),
});
