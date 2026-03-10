import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import type { IUserSortConfig } from '@vemetric/common/sort';
import { clickhouseEvent, clickhouseUser, getUserFilterQueries } from 'clickhouse';
import { getFilterFunnelsData } from '../../utils/filter';
import { isRetentionRestricted, RETENTION_UPGRADE_MESSAGE } from '../../utils/retention';
import {
  authorizationHeaderSchema,
  commonOpenApiErrorResponses,
  planLimitExceededOpenApiResponse,
} from '../schemas/common';
import {
  userEventsRequestSchema,
  userEventsResponseSchema,
  userSingleQuerySchema,
  usersListRequestSchema,
  usersListResponseSchema,
  usersSingleResponseSchema,
} from '../schemas/users';
import type { PublicApiHonoEnv } from '../types';
import { mapApiEventFilter, mapApiFilterConfig } from '../utils/api-to-internal-filter-mapper';
import { normalizeCountryCode, normalizeNullableString } from '../utils/common';
import { formatApiDate, resolveApiDateRange, toApiTimestamp } from '../utils/date';
import { ApiError } from '../utils/errors';

const API_USERS_FIELD_TO_INTERNAL = {
  country: 'countryCode',
} as const;

const usersListRoute = createRoute({
  method: 'post',
  path: '/v1/users',
  summary: 'List users',
  description: 'Returns a list of users with optional filters, sorting and date range.',
  request: {
    headers: authorizationHeaderSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: usersListRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: usersListResponseSchema,
        },
      },
    },
    403: planLimitExceededOpenApiResponse,
    ...commonOpenApiErrorResponses,
  },
});

const usersSingleRoute = createRoute({
  method: 'get',
  path: '/v1/users/single',
  summary: 'Get user',
  description: 'Returns one user by id or identifier.',
  request: {
    headers: authorizationHeaderSchema,
    query: userSingleQuerySchema,
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: usersSingleResponseSchema,
        },
      },
    },
    404: {
      description: 'User was not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z
              .object({
                code: z.literal('USER_NOT_FOUND').openapi({
                  description: 'Machine-readable error code.',
                }),
                message: z.string().openapi({
                  description: 'Human-readable error message.',
                }),
              })
              .openapi({ description: 'Error details.' }),
          }),
        },
      },
    },
    ...commonOpenApiErrorResponses,
  },
});

const userEventsRoute = createRoute({
  method: 'post',
  path: '/v1/users/events',
  summary: 'List user events',
  description: 'Returns events for one user within a specified date range and with optional filters.',
  request: {
    headers: authorizationHeaderSchema,
    query: userSingleQuerySchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: userEventsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: userEventsResponseSchema,
        },
      },
    },
    403: planLimitExceededOpenApiResponse,
    404: {
      description: 'User was not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z
              .object({
                code: z.literal('USER_NOT_FOUND').openapi({
                  description: 'Machine-readable error code.',
                }),
                message: z.string().openapi({
                  description: 'Human-readable error message.',
                }),
              })
              .openapi({ description: 'Error details.' }),
          }),
        },
      },
    },
    ...commonOpenApiErrorResponses,
  },
});

export function registerUserRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(usersListRoute, async ({ req, json, var: { project, subscriptionStatus } }) => {
    const payload = req.valid('json');
    const firstOrderBy = payload.orderBy?.[0];
    const projectId = BigInt(project.id);

    const resolvedDateRange = resolveApiDateRange(payload.dateRange);
    const startDate = resolvedDateRange.startDate;
    const endDate = resolvedDateRange.endDate;

    if (
      isRetentionRestricted({
        timespan: resolvedDateRange.timespan,
        startDate,
        isSubscriptionActive: subscriptionStatus.isActive,
      })
    ) {
      throw new ApiError(403, 'PLAN_LIMIT_EXCEEDED', RETENTION_UPGRADE_MESSAGE);
    }

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
        limit: payload.limit,
        offset: payload.offset,
      },
      filterQueries,
      filterConfig,
      startDate,
      endDate,
      sortConfig: orderByConfig,
    });

    return json(
      {
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
      },
      200,
    );
  });

  api.openapi(usersSingleRoute, async ({ req, json, var: { project } }) => {
    const query = req.valid('query');
    const projectId = BigInt(project.id);
    const userId = query.id !== undefined ? BigInt(query.id) : undefined;

    const user =
      query.id !== undefined
        ? await clickhouseUser.findById(projectId, userId as bigint)
        : await clickhouseUser.findByIdentifier(projectId, query.identifier as string);

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

    return json(
      {
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
      },
      200,
    );
  });

  api.openapi(userEventsRoute, async ({ req, json, var: { project, subscriptionStatus } }) => {
    const query = req.valid('query');
    const payload = req.valid('json');
    const projectId = BigInt(project.id);

    const resolvedDateRange = resolveApiDateRange(payload.dateRange);
    const startDate = resolvedDateRange.startDate;
    const endDate = resolvedDateRange.endDate;

    if (
      isRetentionRestricted({
        timespan: resolvedDateRange.timespan,
        startDate,
        isSubscriptionActive: subscriptionStatus.isActive,
      })
    ) {
      throw new ApiError(403, 'PLAN_LIMIT_EXCEEDED', RETENTION_UPGRADE_MESSAGE);
    }

    let resolvedUserId: bigint | undefined;
    if (query.id !== undefined) {
      resolvedUserId = BigInt(query.id);
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
      resolvedUserId = (await clickhouseUser.findByIdentifier(projectId, query.identifier as string))?.id;
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

    return json(
      {
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
      },
      200,
    );
  });
}
