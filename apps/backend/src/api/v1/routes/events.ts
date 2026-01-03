import type { Hono } from 'hono';
import { clickhouseEvent } from 'clickhouse';
import type { IFilterConfig } from '@vemetric/common/filters';
import {
  dateRangeSchema,
  eventNameParamSchema,
  getPeriodDates,
  getTimeSpanFromPeriod,
  paginationSchema,
} from '../schemas';
import type { ApiContextVars, ApiResponse, PaginatedResponse } from '../types';

interface EventSummary {
  name: string;
  count: number;
  users: number;
}

interface EventProperty {
  name: string;
  count: number;
  users: number;
}

interface EventDetail {
  name: string;
  properties: EventProperty[];
}

export function createEventsRoutes(app: Hono<{ Variables: ApiContextVars }>) {
  // GET /stats/events - Returns list of custom events with count and users
  app.get('/stats/events', async (c) => {
    // Get and validate query parameters
    const rawQuery = c.req.query();
    const querySchema = dateRangeSchema.merge(paginationSchema);
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

    const { period, start_date, end_date, limit, offset } = queryResult.data;
    const apiContext = c.get('api');
    const projectId = apiContext.projectId;

    // Get date range
    const { start: startDate, end: endDate } = getPeriodDates(period, start_date, end_date);

    try {
      // Build filter options
      const filterOptions = {
        timeSpan: getTimeSpanFromPeriod(period),
        startDate,
        endDate,
        filterQueries: '',
        filterConfig: { operator: 'and', filters: [] } as IFilterConfig,
      };

      // Get events
      const events = await clickhouseEvent.getEvents(projectId, filterOptions);

      // Apply pagination
      const paginatedEvents = events.slice(offset, offset + limit);

      const response: PaginatedResponse<EventSummary> = {
        data: paginatedEvents.map((event) => ({
          name: event.name,
          count: event.count,
          users: event.users,
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
            total: events.length,
          },
        },
      };

      return c.json(response);
    } catch (error) {
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch events data',
          },
        },
        500,
      );
    }
  });

  // GET /stats/events/:eventName - Returns single event with properties
  app.get('/stats/events/:eventName', async (c) => {
    // Validate path parameter
    const paramResult = eventNameParamSchema.safeParse(c.req.param());

    if (!paramResult.success) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid event name parameter',
          },
        },
        400,
      );
    }

    const { eventName } = paramResult.data;

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
      // Build filter options
      const filterOptions = {
        startDate,
        endDate,
        filterQueries: '',
        filterConfig: { operator: 'and', filters: [] } as IFilterConfig,
      };

      // Get event properties
      const properties = await clickhouseEvent.getEventProperties(projectId, eventName, filterOptions);

      const eventDetail: EventDetail = {
        name: eventName,
        properties: properties.map((prop) => ({
          name: prop.name,
          count: prop.count,
          users: prop.users,
        })),
      };

      const response: ApiResponse<EventDetail> = {
        data: eventDetail,
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
    } catch (error) {
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch event properties',
          },
        },
        500,
      );
    }
  });

  return app;
}
