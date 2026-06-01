import { formatClickhouseDate } from '@vemetric/common/date';
import { escape } from 'sqlstring';
import { clickhouseClient } from '../client';
import { GLOBE_H3_RESOLUTION, ONLINE_USERS_INTERVAL_QUERY } from '../consts';
import { withSpan } from '../utils/with-span';

const TABLE_NAME = 'event';
const GLOBE_BUCKET_PREVIEW_USER_LIMIT = 3;

export interface ClickhouseGlobeUser {
  id: bigint;
  identifier: string;
  displayName: string;
  countryCode: string;
  city: string;
  latitude: number;
  longitude: number;
  lastSeenAt: string;
  isOnline: boolean;
  avatarUrl?: string;
  h3BucketId: string;
}

export interface ClickhouseGlobeBucket {
  id: string;
  location: [number, number];
  userCount: number;
  users: ClickhouseGlobeUser[];
}

function getGlobeLocatedUsersQuery(props: { projectId: bigint; startDate?: Date; endDate?: Date; userIds?: bigint[] }) {
  const { projectId, startDate, endDate, userIds } = props;

  return `SELECT u.userId as userId, u.identifier as identifier, u.displayName as displayName, u.countryCode as countryCode, u.city as city, u.latitude as latitude, u.longitude as longitude, geoToH3(toFloat64(u.latitude), toFloat64(u.longitude), ${GLOBE_H3_RESOLUTION}) as h3BucketId, u.maxCreatedAt as maxCreatedAt, u.isOnline as isOnline, usr.avatarUrl as avatarUrl
            FROM (
              SELECT userId,
                argMax(userIdentifier, eventCreatedAt) as identifier,
                argMax(userDisplayName, eventCreatedAt) as displayName,
                argMax(countryCode, eventCreatedAt) as countryCode,
                argMax(city, eventCreatedAt) as city,
                argMax(latitude, eventCreatedAt) as latitude,
                argMax(longitude, eventCreatedAt) as longitude,
                max(eventCreatedAt) as maxCreatedAt,
                max(eventCreatedAt) >= ${ONLINE_USERS_INTERVAL_QUERY} as isOnline
              FROM (
                SELECT any(userId) as userId,
                  argMax(userIdentifier, createdAt) as userIdentifier,
                  argMax(userDisplayName, createdAt) as userDisplayName,
                  argMax(countryCode, createdAt) as countryCode,
                  argMax(city, createdAt) as city,
                  assumeNotNull(argMax(latitude, createdAt)) as latitude,
                  assumeNotNull(argMax(longitude, createdAt)) as longitude,
                  max(createdAt) as eventCreatedAt
                FROM ${TABLE_NAME} e
                WHERE e.projectId=${escape(projectId)}
                  ${startDate ? `AND e.createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
                  ${endDate ? `AND e.createdAt < '${formatClickhouseDate(endDate)}'` : ''}
                  ${userIds && userIds.length > 0 ? `AND e.userId IN (${userIds.map((userId) => escape(userId)).join(',')})` : ''}
                  AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL
                GROUP BY id
                HAVING sum(sign) > 0
              )
              GROUP BY userId
            ) u
            LEFT JOIN (
              SELECT id, argMax(avatarUrl, updatedAt) as avatarUrl
              FROM user
              WHERE projectId=${escape(projectId)}
              GROUP BY id
              HAVING argMax(deleted, updatedAt) = 0
            ) usr ON u.userId = usr.id`;
}

function mapRowToGlobeUser(row: any): ClickhouseGlobeUser {
  return {
    id: BigInt(row.userId),
    identifier: row.identifier as string,
    displayName: row.displayName as string,
    countryCode: row.countryCode as string,
    city: row.city as string,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    lastSeenAt: row.maxCreatedAt as string,
    isOnline: Boolean(row.isOnline),
    avatarUrl: row.avatarUrl as string | undefined,
    h3BucketId: String(row.h3BucketId),
  };
}

export const clickhouseGlobe = {
  queryGlobeBuckets: withSpan(
    'queryGlobeBuckets',
    async (input: { projectId: bigint; startDate?: Date; endDate?: Date }): Promise<ClickhouseGlobeBucket[]> => {
      const { projectId, startDate, endDate } = input;

      const resultSet = await clickhouseClient.query({
        query: `WITH located_users AS (
              ${getGlobeLocatedUsersQuery({ projectId, startDate, endDate })}
            ),
            ranked_users AS (
              SELECT *,
                row_number() OVER (PARTITION BY h3BucketId ORDER BY maxCreatedAt DESC, userId DESC) as bucketUserRank
              FROM located_users
            ),
            buckets AS (
              SELECT h3BucketId,
                count() as userCount,
                argMin(
                  latitude,
                  pow(latitude - tupleElement(h3ToGeo(h3BucketId), 1), 2) +
                    pow(longitude - tupleElement(h3ToGeo(h3BucketId), 2), 2)
                ) as bucketLatitude,
                argMin(
                  longitude,
                  pow(latitude - tupleElement(h3ToGeo(h3BucketId), 1), 2) +
                    pow(longitude - tupleElement(h3ToGeo(h3BucketId), 2), 2)
                ) as bucketLongitude,
                max(maxCreatedAt) as maxCreatedAt
              FROM located_users
              GROUP BY h3BucketId
            )
            SELECT b.h3BucketId as bucketId,
              b.userCount as userCount,
              b.bucketLatitude as bucketLatitude,
              b.bucketLongitude as bucketLongitude,
              p.userId as userId,
              p.identifier as identifier,
              p.displayName as displayName,
              p.countryCode as countryCode,
              p.city as city,
              p.latitude as latitude,
              p.longitude as longitude,
              p.maxCreatedAt as maxCreatedAt,
              p.isOnline as isOnline,
              p.avatarUrl as avatarUrl,
              p.bucketUserRank as bucketUserRank
            FROM buckets b
            LEFT JOIN ranked_users p ON b.h3BucketId = p.h3BucketId
              AND p.bucketUserRank <= ${GLOBE_BUCKET_PREVIEW_USER_LIMIT}
            ORDER BY b.maxCreatedAt DESC, p.bucketUserRank ASC`,
        format: 'JSONEachRow',
      });
      const rows = (await resultSet.json()) as Array<any>;
      const buckets = new Map<string, ClickhouseGlobeBucket>();

      for (const row of rows) {
        const id = String(row.bucketId);
        let bucket = buckets.get(id);
        if (!bucket) {
          bucket = {
            id,
            location: [Number(row.bucketLatitude), Number(row.bucketLongitude)],
            userCount: Number(row.userCount),
            users: [],
          };
          buckets.set(id, bucket);
        }

        if (row.userId !== null && row.userId !== undefined) {
          bucket.users.push(
            mapRowToGlobeUser({
              ...row,
              h3BucketId: row.bucketId,
            }),
          );
        }
      }

      return Array.from(buckets.values());
    },
  ),
  queryGlobeBucketUsers: withSpan(
    'queryGlobeBucketUsers',
    async (input: {
      projectId: bigint;
      startDate?: Date;
      endDate?: Date;
      bucketIds: string[];
    }): Promise<ClickhouseGlobeUser[]> => {
      const { projectId, startDate, endDate, bucketIds } = input;

      const resultSet = await clickhouseClient.query({
        query: `SELECT *
            FROM (
              ${getGlobeLocatedUsersQuery({ projectId, startDate, endDate })}
            )
            WHERE h3BucketId IN (${bucketIds.map((bucketId) => `toUInt64(${escape(bucketId)})`).join(',')})
            ORDER BY maxCreatedAt DESC, userId DESC`,
        format: 'JSONEachRow',
      });
      const result = (await resultSet.json()) as Array<any>;

      return result.map(mapRowToGlobeUser);
    },
  ),
  queryJoinedUsersSince: withSpan(
    'queryJoinedUsersSince',
    async (input: { projectId: bigint; startDate?: Date; endDate?: Date; since: Date; limit: number }) => {
      const { projectId, startDate, endDate, since, limit } = input;

      const resultSet = await clickhouseClient.query({
        query: `SELECT u.userId as userId, u.identifier as identifier, u.displayName as displayName, u.firstSeenAt as firstSeenAt, if(u.latitude IS NULL OR u.longitude IS NULL, NULL, geoToH3(toFloat64(coalesce(u.latitude, 0)), toFloat64(coalesce(u.longitude, 0)), ${GLOBE_H3_RESOLUTION})) as h3BucketId, usr.avatarUrl as avatarUrl
            FROM (
              SELECT userId,
                argMax(userIdentifier, eventCreatedAt) as identifier,
                argMax(userDisplayName, eventCreatedAt) as displayName,
                argMaxIf(eventLatitude, eventCreatedAt, eventLatitude IS NOT NULL AND eventLongitude IS NOT NULL) as latitude,
                argMaxIf(eventLongitude, eventCreatedAt, eventLatitude IS NOT NULL AND eventLongitude IS NOT NULL) as longitude,
                min(eventCreatedAt) as firstSeenAt
              FROM (
                SELECT any(userId) as userId,
                  argMax(userIdentifier, createdAt) as userIdentifier,
                  argMax(userDisplayName, createdAt) as userDisplayName,
                  argMax(latitude, createdAt) as eventLatitude,
                  argMax(longitude, createdAt) as eventLongitude,
                  max(createdAt) as eventCreatedAt
                FROM ${TABLE_NAME}
                WHERE projectId=${escape(projectId)}
                  ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
                  ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
                GROUP BY id
                HAVING sum(sign) > 0
              )
              GROUP BY userId
              HAVING firstSeenAt > '${formatClickhouseDate(since)}'
            ) u
            LEFT JOIN (
              SELECT id, argMax(avatarUrl, updatedAt) as avatarUrl
              FROM user
              WHERE projectId=${escape(projectId)}
              GROUP BY id
              HAVING argMax(deleted, updatedAt) = 0
            ) usr ON u.userId = usr.id
            ORDER BY u.firstSeenAt DESC, u.userId DESC
            LIMIT ${escape(limit)}`,
        format: 'JSONEachRow',
      });
      const result = (await resultSet.json()) as Array<any>;

      return result.map((row) => ({
        id: BigInt(row.userId),
        identifier: row.identifier as string,
        displayName: row.displayName as string,
        avatarUrl: row.avatarUrl as string,
        joinedAt: row.firstSeenAt as string,
        h3BucketId: row.h3BucketId !== null ? String(row.h3BucketId) : null,
      }));
    },
  ),
};
