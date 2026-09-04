import { isEntityUnknown } from '@vemetric/common/event';
import type { ClickhouseEvent } from 'clickhouse';
import { clickhouseDateToISO, clickhouseEvent, clickhouseGlobe, clickhouseSession, clickhouseUser } from 'clickhouse';
import { z } from 'zod';
import { getVisualGlobeBuckets } from '../utils/globe';
import { projectProcedure, projectTimespanProcedure, router } from '../utils/trpc';

const PANEL_USERS_PER_PAGE = 50;
const BUCKET_USERS_LIMIT = 100;
const MAX_BUCKET_IDS_PER_REQUEST = 100;
const JOINED_USERS_LIMIT = 250;
const userCursorSchema = z.object({
  lastSeenAt: z.string().datetime(),
  userId: z.string().regex(/^\d+$/),
});
const joinedUserCursorSchema = z.object({
  firstSeenAt: z.string().datetime(),
  userId: z.string().regex(/^\d+$/).optional(),
});

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
        bucketIds: z.array(z.string()).min(1).max(MAX_BUCKET_IDS_PER_REQUEST),
      }),
    )
    .query(async (opts) => {
      const {
        input: { bucketIds },
        ctx: { projectId, startDate, endDate },
      } = opts;

      const users = await clickhouseGlobe.queryGlobeBucketUsers({
        projectId,
        startDate,
        endDate,
        bucketIds,
        limit: BUCKET_USERS_LIMIT + 1,
      });
      const hasMore = users.length > BUCKET_USERS_LIMIT;
      const boundedUsers = users.slice(0, BUCKET_USERS_LIMIT);

      return {
        users: boundedUsers.map((user) => ({
          ...user,
          id: String(user.id),
        })),
        hasMore,
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
        cursor: userCursorSchema.optional(),
      }),
    )
    .query(async (opts) => {
      const {
        input,
        ctx: { projectId, startDate, endDate },
      } = opts;

      const users = await clickhouseEvent.queryUsers({
        projectId,
        startDate,
        endDate,
        filterQueries: '',
        pagination: {
          type: 'lastSeenCursor',
          limit: PANEL_USERS_PER_PAGE + 1,
          cursor: input.cursor
            ? {
                lastSeenAt: new Date(input.cursor.lastSeenAt),
                userId: BigInt(input.cursor.userId),
              }
            : undefined,
        },
      });
      const hasNextPage = users.length > PANEL_USERS_PER_PAGE;
      const paginatedUsers = users.slice(0, PANEL_USERS_PER_PAGE);
      const lastUser = paginatedUsers.at(-1);

      return {
        users: paginatedUsers.map((user) => ({
          ...user,
          id: String(user.id),
        })),
        nextCursor:
          hasNextPage && lastUser
            ? {
                lastSeenAt: new Date(clickhouseDateToISO(lastUser.lastSeenAt)).toISOString(),
                userId: String(lastUser.id),
              }
            : undefined,
      };
    }),
  getJoinedUsersSince: projectTimespanProcedure
    .input(
      z.object({
        cursor: joinedUserCursorSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input,
        ctx: { projectId, startDate, endDate },
      } = opts;
      const users = await clickhouseGlobe.queryJoinedUsersSince({
        projectId,
        startDate,
        endDate,
        cursor: {
          firstSeenAt: new Date(input.cursor.firstSeenAt),
          userId: input.cursor.userId ? BigInt(input.cursor.userId) : undefined,
        },
        limit: JOINED_USERS_LIMIT,
      });
      const lastUser = users.at(-1);

      return {
        users: users.map((user) => ({
          id: String(user.id),
          displayName: user.displayName,
          identifier: user.identifier,
          avatarUrl: user.avatarUrl,
          h3BucketId: user.h3BucketId,
        })),
        nextCursor: lastUser
          ? {
              firstSeenAt: new Date(clickhouseDateToISO(lastUser.joinedAt)).toISOString(),
              userId: String(lastUser.id),
            }
          : input.cursor,
      };
    }),
});
