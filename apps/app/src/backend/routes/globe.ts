import { clickhouseEvent } from 'clickhouse';
import { z } from 'zod';
import { getGlobeUserBuckets } from '../utils/globe';
import { projectTimespanProcedure, router } from '../utils/trpc';

const PANEL_USERS_PER_PAGE = 50;

export const globeRouter = router({
  getMarkers: projectTimespanProcedure.query(async (opts) => {
    const {
      ctx: { project, projectId, startDate, endDate },
    } = opts;

    const [locatedUsers, totalUsers] = await Promise.all([
      clickhouseEvent.queryGlobeUsers({ projectId, startDate, endDate }),
      clickhouseEvent.getActiveUsers(projectId, { startDate, endDate }),
    ]);
    const isInitialized =
      Boolean(totalUsers && totalUsers > 0) || (await clickhouseEvent.getAllEventsCount(projectId)) > 0;
    const buckets = getGlobeUserBuckets(locatedUsers);

    return {
      projectToken: project.token,
      isInitialized,
      totalUsers: totalUsers ?? 0,
      locatedUsers: locatedUsers.length,
      buckets: buckets.map((bucket) => ({
        ...bucket,
        users: bucket.users.map((user) => ({
          ...user,
          id: String(user.id),
        })),
      })),
    };
  }),
  listUsers: projectTimespanProcedure
    .input(
      z.object({
        cursor: z.number().min(1).optional(),
      }),
    )
    .query(async (opts) => {
      const {
        input,
        ctx: { projectId, startDate, endDate },
      } = opts;
      const page = input.cursor ?? 1;

      const users = await clickhouseEvent.queryUsers({
        projectId,
        startDate,
        endDate,
        filterQueries: '',
        pagination: {
          offset: (page - 1) * PANEL_USERS_PER_PAGE,
          limit: PANEL_USERS_PER_PAGE + 1,
        },
      });
      const hasNextPage = users.length > PANEL_USERS_PER_PAGE;
      const paginatedUsers = hasNextPage ? users.slice(0, -1) : users;

      return {
        users: paginatedUsers.map((user) => ({
          ...user,
          id: String(user.id),
          latitude: null,
          longitude: null,
        })),
        nextCursor: hasNextPage ? page + 1 : undefined,
      };
    }),
});
