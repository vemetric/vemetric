import { isEntityUnknown } from '@vemetric/common/event';
import type { ClickhouseEvent } from 'clickhouse';
import { clickhouseDateToISO, clickhouseEvent, clickhouseGlobe, clickhouseSession, clickhouseUser } from 'clickhouse';
import { z } from 'zod';
import { getVisualGlobeBuckets } from '../utils/globe';
import { projectProcedure, projectTimespanProcedure, router } from '../utils/trpc';

const PANEL_USERS_PER_PAGE = 50;
const JOINED_USERS_LIMIT = 250;

export const globeRouter = router({
  getMarkers: projectTimespanProcedure.query(async (opts) => {
    const {
      ctx: { project, projectId, startDate, endDate },
    } = opts;

    const [h3Buckets, totalUsers] = await Promise.all([
      clickhouseGlobe.queryGlobeBuckets({ projectId, startDate, endDate }),
      clickhouseEvent.getActiveUsers(projectId, { startDate, endDate }),
    ]);
    const isInitialized =
      Boolean(totalUsers && totalUsers > 0) || (await clickhouseEvent.getAllEventsCount(projectId)) > 0;
    const buckets = getVisualGlobeBuckets(h3Buckets);

    return {
      projectToken: project.token,
      isInitialized,
      totalUsers: totalUsers ?? 0,
      locatedUsers: h3Buckets.reduce((total, bucket) => total + bucket.userCount, 0),
      buckets: buckets.map((bucket) => ({
        ...bucket,
        users: bucket.users.map((user) => ({
          ...user,
          id: String(user.id),
        })),
      })),
    };
  }),
  getBucketUsers: projectTimespanProcedure
    .input(
      z.object({
        bucketIds: z.array(z.string()).min(1),
      }),
    )
    .query(async (opts) => {
      const {
        input: { bucketIds },
        ctx: { projectId, startDate, endDate },
      } = opts;

      const users = await clickhouseGlobe.queryGlobeBucketUsers({ projectId, startDate, endDate, bucketIds });

      return {
        users: users.map((user) => ({
          ...user,
          id: String(user.id),
        })),
      };
    }),
  singleUser: projectProcedure.input(z.object({ userId: z.string() })).query(async (opts) => {
    const {
      input,
      ctx: { projectId },
    } = opts;

    const userId = BigInt(input.userId);

    const [latestEvents, user, latestSession, latestPageView] = await Promise.all([
      clickhouseEvent.getLatestEventsByUserId({ projectId, userId, limit: 1 }),
      clickhouseUser.findById(projectId, userId, true),
      clickhouseSession.findLatestByUserId(projectId, userId),
      clickhouseEvent.getLatestPageViewByUserId(projectId, userId),
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
      latestPageView,
      latestSession: latestSession
        ? { ...latestSession, projectId: String(latestSession.projectId), userId: String(latestSession.userId) }
        : null,
      user: user
        ? { ...user, id: String(user.id), displayName: user.displayName || latestEvent?.userDisplayName }
        : null,
      deviceData,
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
        })),
        nextCursor: hasNextPage ? page + 1 : undefined,
      };
    }),
  getJoinedUsersSince: projectTimespanProcedure
    .input(
      z.object({
        since: z.string().datetime(),
      }),
    )
    .query(async (opts) => {
      const {
        input,
        ctx: { projectId, startDate, endDate },
      } = opts;
      const sinceDate = new Date(input.since);

      const users = await clickhouseGlobe.queryJoinedUsersSince({
        projectId,
        startDate,
        endDate,
        since: sinceDate,
        limit: JOINED_USERS_LIMIT,
      });

      return {
        users: users.map((user) => ({
          id: String(user.id),
          displayName: user.displayName,
          identifier: user.identifier,
          avatarUrl: user.avatarUrl,
          h3BucketId: user.h3BucketId,
        })),
        nextSince:
          users
            .reduce<Date | null>((latest, user) => {
              const joinedAt = new Date(clickhouseDateToISO(user.joinedAt));

              return !latest || joinedAt > latest ? joinedAt : latest;
            }, null)
            ?.toISOString() ?? input.since,
      };
    }),
});
