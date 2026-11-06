import type { z } from '@hono/zod-openapi';
import type { IUserSortConfig } from '@vemetric/common/sort';
import { clickhouseEvent, clickhouseUser, getUserFilterQueries } from 'clickhouse';
import { assertRetentionAllowed, type ApiServiceContext } from './context';
import { getFilterFunnelsData } from '../../utils/filter';
import type {
  userEventsRequestSchema,
  userEventsResponseSchema,
  userSingleQuerySchema,
  usersListRequestSchema,
  usersListResponseSchema,
  usersSingleResponseSchema,
} from '../schemas/users';
import { mapApiEventFilter, mapApiFilterConfig } from '../utils/api-to-internal-filter-mapper';
import { normalizeCountryCode, normalizeNullableString } from '../utils/common';
import { formatApiDate, resolveApiDateRange, toApiTimestamp } from '../utils/date';
import { ApiError } from '../utils/errors';

export type UsersListInput = z.output<typeof usersListRequestSchema>;
export type UsersListResult = z.output<typeof usersListResponseSchema>;
/** Exactly one of `id` (Vemetric's internal user id) or `identifier` is set. */
export type UserReference = z.output<typeof userSingleQuerySchema>;
export type UserResult = z.output<typeof usersSingleResponseSchema>;
export type UserEventsInput = z.output<typeof userEventsRequestSchema>;
export type UserEventsResult = z.output<typeof userEventsResponseSchema>;

const API_USERS_FIELD_TO_INTERNAL = {
  country: 'countryCode',
} as const;

export async function listUsers(ctx: ApiServiceContext, payload: UsersListInput): Promise<UsersListResult> {
  const { project } = ctx;
  const firstOrderBy = payload.orderBy?.[0];
  const projectId = BigInt(project.id);

  const { timespan, startDate, endDate } = resolveApiDateRange(payload.dateRange);
  assertRetentionAllowed(ctx, { timespan, startDate });

  const filterConfig = mapApiFilterConfig(payload.filters, payload.filtersOperator);
  const funnelsData = filterConfig ? await getFilterFunnelsData(project.id, filterConfig) : null;
  const { filterQueries } = getUserFilterQueries({
    filterConfig,
    projectId,
    startDate,
    endDate,
    funnelsData: funnelsData ?? new Map(),
  });

  const orderByConfig: IUserSortConfig =
    firstOrderBy?.[0] === 'lastEventFired'
      ? {
          direction: firstOrderBy[1],
          by: mapApiEventFilter({
            type: 'event',
            ...firstOrderBy[2],
          }),
        }
      : {
          by: {
            type: 'field',
            fieldName:
              API_USERS_FIELD_TO_INTERNAL[firstOrderBy?.[0] as keyof typeof API_USERS_FIELD_TO_INTERNAL] ??
              firstOrderBy?.[0] ??
              'lastSeenAt',
          },
          direction: firstOrderBy?.[1] ?? 'desc',
        };

  const rows = await clickhouseEvent.queryUsers({
    projectId,
    pagination: {
      type: 'offset',
      limit: payload.limit,
      offset: payload.offset,
    },
    filterQueries,
    filterConfig,
    startDate,
    endDate,
    sortConfig: orderByConfig,
  });

  return {
    period: {
      from: formatApiDate(startDate),
      to: formatApiDate(endDate ?? new Date()),
    },
    pagination: {
      limit: payload.limit,
      offset: payload.offset,
      returned: rows.length,
    },
    users: rows.map((row) => {
      const identifier = normalizeNullableString(row.identifier);
      const displayName = normalizeNullableString(row.displayName);

      return {
        id: String(row.id),
        identifier,
        displayName,
        country: normalizeCountryCode(row.countryCode),
        city: normalizeNullableString(row.city),
        lastSeenAt: toApiTimestamp(row.lastSeenAt),
        lastEventFiredAt: toApiTimestamp(row.lastEventFiredAt),
        avatarUrl: normalizeNullableString(row.avatarUrl),
        data: row.data ?? {},
        anonymous: identifier === null,
      };
    }),
  };
}

export async function getUser({ project }: ApiServiceContext, userRef: UserReference): Promise<UserResult> {
  const projectId = BigInt(project.id);
  const userId = userRef.id !== undefined ? BigInt(userRef.id) : undefined;

  const user =
    userRef.id !== undefined
      ? await clickhouseUser.findById(projectId, userId as bigint)
      : await clickhouseUser.findByIdentifier(projectId, userRef.identifier as string);

  const resolvedUserId = user?.id ?? userId;
  if (resolvedUserId === undefined) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const latestEvents = await clickhouseEvent.getLatestEventsByUserId({
    projectId,
    userId: resolvedUserId,
    limit: 1,
  });
  const latestEvent = latestEvents[0] ?? null;

  if (!user && !latestEvent) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const identifier = normalizeNullableString(user?.identifier || latestEvent?.userIdentifier);
  const displayName = normalizeNullableString(user?.displayName || latestEvent?.userDisplayName);
  const countryCode = normalizeCountryCode(user?.countryCode || latestEvent?.countryCode);
  const city = normalizeNullableString(user?.city || latestEvent?.city);

  return {
    user: {
      id: String(resolvedUserId),
      identifier,
      displayName,
      country: countryCode,
      city,
      lastSeenAt: toApiTimestamp(latestEvent?.createdAt),
      avatarUrl: normalizeNullableString(user?.avatarUrl),
      data: user?.customData ?? {},
      anonymous: identifier === null,
    },
  };
}

export async function getUserEvents(
  ctx: ApiServiceContext,
  userRef: UserReference,
  payload: UserEventsInput,
): Promise<UserEventsResult> {
  const projectId = BigInt(ctx.project.id);

  const { timespan, startDate, endDate } = resolveApiDateRange(payload.dateRange);
  assertRetentionAllowed(ctx, { timespan, startDate });

  let resolvedUserId: bigint | undefined;
  if (userRef.id !== undefined) {
    resolvedUserId = BigInt(userRef.id);
    const [userRecord, latestEvent] = await Promise.all([
      clickhouseUser.findById(projectId, resolvedUserId),
      clickhouseEvent.getLatestEventsByUserId({
        projectId,
        userId: resolvedUserId,
        limit: 1,
      }),
    ]);
    if (!userRecord && latestEvent.length === 0) {
      resolvedUserId = undefined;
    }
  } else {
    const identifier = userRef.identifier!;
    resolvedUserId = (await clickhouseUser.findByIdentifier(projectId, identifier))?.id;
  }

  if (resolvedUserId === undefined) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const filterConfig = mapApiFilterConfig(payload.filters, payload.filtersOperator);
  const events = await clickhouseEvent.getLatestEventsByUserId({
    projectId,
    userId: resolvedUserId,
    limit: payload.limit,
    offset: payload.offset,
    startDate,
    endDate,
    filterConfig,
  });

  return {
    period: {
      from: formatApiDate(startDate),
      to: formatApiDate(endDate ?? new Date()),
    },
    pagination: {
      limit: payload.limit,
      offset: payload.offset,
      returned: events.length,
    },
    events: events.map((event) => ({
      sessionId: event.sessionId,
      name: event.name,
      isPageView: Boolean(event.isPageView),
      createdAt: toApiTimestamp(event.createdAt) as string,
      origin: normalizeNullableString(event.origin),
      path: normalizeNullableString(event.pathname),
      hash: normalizeNullableString(event.urlHash),
      data: event.customData ?? {},
    })),
  };
}
