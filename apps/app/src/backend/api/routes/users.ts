import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import type { IUserSortConfig } from '@vemetric/common/sort';
import { clickhouseEvent, clickhouseUser, getUserFilterQueries } from 'clickhouse';
import { getFilterFunnelsData } from '../../utils/filter';
import { isRetentionRestricted, RETENTION_UPGRADE_MESSAGE } from '../../utils/retention';
import { authorizationHeaderSchema, commonOpenApiErrorResponses } from '../schemas/common';
import {
  userSingleQuerySchema,
  usersListRequestSchema,
  usersListResponseSchema,
  usersSingleResponseSchema,
} from '../schemas/users';
import type { PublicApiHonoEnv } from '../types';
import { mapApiEventFilter, mapApiFilterConfig } from '../utils/api-filter-mapper';
import { normalizeCountryCode, normalizeNullableString } from '../utils/common';
import { formatApiDate, resolveApiDateRange, toApiTimestamp } from '../utils/date';
import { ApiError } from '../utils/errors';

const API_USERS_FIELD_TO_INTERNAL = {
  last_seen_at: 'lastSeenAt',
  display_name: 'displayName',
  identifier: 'identifier',
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
    403: {
      description: 'Requested date range is not allowed for the current plan',
      content: {
        'application/json': {
          schema: z.object({
            error: z.object({
              code: z.literal('PLAN_LIMIT_EXCEEDED'),
              message: z.string(),
            }),
          }),
        },
      },
    },
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

export function registerUserRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(usersListRoute, async ({ req, json, var: { project, subscriptionStatus } }) => {
    const payload = req.valid('json');
    const firstOrderBy = payload.order_by?.[0];
    const projectId = BigInt(project.id);

    const resolvedDateRange = resolveApiDateRange(payload.date_range ?? '30days');
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

    const filterConfig = mapApiFilterConfig(payload.filters, payload.filters_operator);
    const funnelsData = filterConfig ? await getFilterFunnelsData(project.id, filterConfig) : null;
    const { filterQueries } = getUserFilterQueries({
      filterConfig,
      projectId,
      startDate,
      endDate,
      funnelsData: funnelsData ?? new Map(),
    });

    const orderByConfig: IUserSortConfig =
      firstOrderBy?.[0] === 'last_event_fired'
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
                API_USERS_FIELD_TO_INTERNAL[firstOrderBy?.[0] ?? 'last_seen_at'] ??
                API_USERS_FIELD_TO_INTERNAL.last_seen_at,
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
            display_name: displayName,
            country: normalizeCountryCode(row.countryCode),
            city: normalizeNullableString(row.city),
            last_seen_at: toApiTimestamp(row.lastSeenAt),
            last_event_fired_at: toApiTimestamp(row.lastEventFiredAt),
            avatar_url: normalizeNullableString(row.avatarUrl),
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
          display_name: displayName,
          country: countryCode,
          city,
          last_seen_at: toApiTimestamp(latestEvent?.createdAt),
          avatar_url: normalizeNullableString(user?.avatarUrl),
          anonymous: identifier === null,
        },
      },
      200,
    );
  });
}
