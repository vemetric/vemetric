import { isEntityUnknown } from '@vemetric/common/event';
import type { ClickhouseEvent } from 'clickhouse';
import { clickhouseDateToISO, clickhouseEvent, clickhouseSession, clickhouseUser } from 'clickhouse';
import { z } from 'zod';
import { getGlobeUserBuckets } from '../utils/globe';
import { projectProcedure, projectTimespanProcedure, router } from '../utils/trpc';

const PANEL_USERS_PER_PAGE = 50;
const JOINED_USERS_LIMIT = 250;
const BUCKET_PREVIEW_USERS = 3;

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
        users: bucket.users.slice(0, BUCKET_PREVIEW_USERS).map((user) => ({
          ...user,
          id: String(user.id),
        })),
      })),
    };
  }),
  getBucketUsers: projectTimespanProcedure
    .input(
      z.object({
        bucketId: z.string(),
      }),
    )
    .query(async (opts) => {
      const {
        input: { bucketId },
        ctx: { projectId, startDate, endDate },
      } = opts;

      const locatedUsers = await clickhouseEvent.queryGlobeUsers({ projectId, startDate, endDate });
      const bucket = getGlobeUserBuckets(locatedUsers).find((candidate) => candidate.id === bucketId);

      return {
        users:
          bucket?.users.map((user) => ({
            ...user,
            id: String(user.id),
          })) ?? [],
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

      const [users, locatedUsers] = await Promise.all([
        clickhouseEvent.queryUsers({
          projectId,
          startDate,
          endDate,
          filterQueries: '',
          pagination: {
            offset: (page - 1) * PANEL_USERS_PER_PAGE,
            limit: PANEL_USERS_PER_PAGE + 1,
          },
        }),
        // TODO: can we improve this once we have H3 stable bucket ids?
        clickhouseEvent.queryGlobeUsers({ projectId, startDate, endDate }),
      ]);
      const hasNextPage = users.length > PANEL_USERS_PER_PAGE;
      const paginatedUsers = hasNextPage ? users.slice(0, -1) : users;
      const globeBucketIdByUserId = new Map(
        getGlobeUserBuckets(locatedUsers).flatMap((bucket) =>
          bucket.users.map((user): [string, string] => [String(user.id), bucket.id]),
        ),
      );

      return {
        users: paginatedUsers.map((user) => ({
          ...user,
          id: String(user.id),
          globeBucketId: globeBucketIdByUserId.get(String(user.id)) ?? null,
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

      const [users, locatedUsers] = await Promise.all([
        clickhouseEvent.queryJoinedUsersSince({
          projectId,
          startDate,
          endDate,
          since: sinceDate,
          limit: JOINED_USERS_LIMIT,
        }),
        // TODO: can we improve this once we have H3 stable bucket ids?
        clickhouseEvent.queryGlobeUsers({ projectId, startDate, endDate }),
      ]);
      const globeBucketIdByUserId = new Map(
        getGlobeUserBuckets(locatedUsers).flatMap((bucket) =>
          bucket.users.map((user): [string, string] => [String(user.id), bucket.id]),
        ),
      );

      return {
        users: users.map((user) => ({
          id: String(user.id),
          displayName: user.displayName,
          identifier: user.identifier,
          avatarUrl: user.avatarUrl,
          globeBucketId: globeBucketIdByUserId.get(String(user.id)) ?? null,
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
