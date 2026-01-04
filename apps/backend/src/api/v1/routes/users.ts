import type { IFilterConfig } from '@vemetric/common/filters';
import { clickhouseEvent, clickhouseUser } from 'clickhouse';
import type { Hono } from 'hono';
import { z } from 'zod';
import {
  dateRangeSchema,
  getPeriodDates,
  paginationSchema,
  statsQuerySchema,
  userIdParamSchema,
} from '../schemas';
import type { ApiContextVars, ApiResponse, PaginatedResponse } from '../types';

interface UserStats {
  id: string;
  identifier: string;
  displayName: string;
  countryCode: string;
  lastSeenAt: string;
  isOnline: boolean;
  avatarUrl?: string;
}

interface UserDetail {
  id: string;
  identifier: string;
  displayName?: string;
  avatarUrl?: string;
  countryCode: string;
  city: string;
  createdAt: string;
  firstSeenAt: string;
  updatedAt: string;
  customData: Record<string, any>;
  device?: {
    clientName: string;
    clientVersion: string;
    osName: string;
    osVersion: string;
    deviceType: string;
  };
}

interface UserEvent {
  id: string;
  name: string;
  pathname: string;
  origin: string;
  createdAt: string;
  isPageView: boolean;
  sessionId: string;
  isOnline: boolean;
  customData: Record<string, any>;
}

export function createUsersRoutes(app: Hono<{ Variables: ApiContextVars }>) {
  // GET /stats/users - Returns list of users with activity (paginated)
  app.get('/stats/users', async (c) => {
    // Get and validate query parameters
    const rawQuery = c.req.query();
    const querySchema = statsQuerySchema.extend({
      search: z.string().optional(),
    });
    const queryResult = querySchema.safeParse(rawQuery);

    if (!queryResult.success) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid query parameters',
          },
        },
        400,
      );
    }

    const { period, start_date, end_date, limit, offset, search } = queryResult.data;
    const apiContext = c.get('api');
    const projectId = apiContext.projectId;

    // Get date range
    const { start: startDate, end: endDate } = getPeriodDates(period, start_date, end_date);

    try {
      // Get users with default sort config
      const users = await clickhouseEvent.getLatestUsers(
        projectId,
        { offset, limit },
        '',
        { operator: 'and', filters: [] } as IFilterConfig,
        { key: 'last_seen_at', order: 'desc' },
        startDate,
        search,
      );

      const response: PaginatedResponse<UserStats> = {
        data: users.map((user) => ({
          id: String(user.id),
          identifier: user.identifier,
          displayName: user.displayName,
          countryCode: user.countryCode,
          lastSeenAt: user.lastSeenAt,
          isOnline: user.isOnline,
          avatarUrl: user.avatarUrl,
        })),
        meta: {
          project_id: apiContext.project.id,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          generated_at: new Date().toISOString(),
          pagination: {
            limit,
            offset,
            total: users.length,
          },
        },
      };

      return c.json(response);
    } catch {
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch users data',
          },
        },
        500,
      );
    }
  });

  // GET /stats/users/:userId - Returns single user details
  app.get('/stats/users/:userId', async (c) => {
    // Validate path parameter
    const paramResult = userIdParamSchema.safeParse(c.req.param());

    if (!paramResult.success) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid userId parameter',
          },
        },
        400,
      );
    }

    const { userId } = paramResult.data;

    // Validate query parameters
    const rawQuery = c.req.query();
    const queryResult = dateRangeSchema.safeParse(rawQuery);

    if (!queryResult.success) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid query parameters',
          },
        },
        400,
      );
    }

    const { period, start_date, end_date } = queryResult.data;
    const apiContext = c.get('api');
    const projectId = apiContext.projectId;

    // Get date range
    const { start: startDate, end: endDate } = getPeriodDates(period, start_date, end_date);

    try {
      // Get user details with device information
      const user = await clickhouseUser.findById(projectId, BigInt(userId), true);

      if (!user) {
        return c.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'User not found',
            },
          },
          404,
        );
      }

      const userDetail: UserDetail = {
        id: String(user.id),
        identifier: user.identifier,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        countryCode: user.countryCode,
        city: user.city,
        createdAt: user.createdAt,
        firstSeenAt: user.firstSeenAt,
        updatedAt: user.updatedAt,
        customData: user.customData,
        ...(user.device && {
          device: {
            clientName: user.device.clientName,
            clientVersion: user.device.clientVersion,
            osName: user.device.osName,
            osVersion: user.device.osVersion,
            deviceType: user.device.deviceType,
          },
        }),
      };

      const response: ApiResponse<UserDetail> = {
        data: userDetail,
        meta: {
          project_id: apiContext.project.id,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          generated_at: new Date().toISOString(),
        },
      };

      return c.json(response);
    } catch {
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch user details',
          },
        },
        500,
      );
    }
  });

  // GET /stats/users/:userId/events - Returns user's recent events (max 100)
  app.get('/stats/users/:userId/events', async (c) => {
    // Validate path parameter
    const paramResult = userIdParamSchema.safeParse(c.req.param());

    if (!paramResult.success) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid userId parameter',
          },
        },
        400,
      );
    }

    const { userId } = paramResult.data;

    // Validate query parameters
    const rawQuery = c.req.query();
    const querySchema = dateRangeSchema.merge(paginationSchema).extend({
      cursor: z.string().optional(),
    });
    const queryResult = querySchema.safeParse(rawQuery);

    if (!queryResult.success) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid query parameters',
          },
        },
        400,
      );
    }

    const { period, start_date, end_date, limit: requestedLimit, cursor } = queryResult.data;
    const apiContext = c.get('api');
    const projectId = apiContext.projectId;

    // Enforce max limit of 100
    const limit = Math.min(requestedLimit, 100);

    // Get date range
    const { start: startDate, end: endDate } = getPeriodDates(period, start_date, end_date);

    try {
      // Get user's recent events
      const events = await clickhouseEvent.getLatestEventsByUserId({
        projectId,
        userId: BigInt(userId),
        limit,
        cursor,
        startDate,
        filterConfig: { operator: 'and', filters: [] } as IFilterConfig,
      });

      const response: PaginatedResponse<UserEvent> = {
        data: events.map((event) => ({
          id: event.id,
          name: event.name,
          pathname: event.pathname,
          origin: event.origin,
          createdAt: event.createdAt,
          isPageView: event.isPageView,
          sessionId: event.sessionId,
          isOnline: event.isOnline,
          customData: event.customData,
        })),
        meta: {
          project_id: apiContext.project.id,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          generated_at: new Date().toISOString(),
          pagination: {
            limit,
            offset: 0,
            total: events.length,
          },
        },
      };

      return c.json(response);
    } catch {
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch user events',
          },
        },
        500,
      );
    }
  });
}
