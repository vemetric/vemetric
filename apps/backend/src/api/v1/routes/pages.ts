import { formatClickhouseDate } from '@vemetric/common/date';
import type { IFilterConfig } from '@vemetric/common/filters';
import { clickhouseClient, clickhouseEvent } from 'clickhouse';
import type { Hono } from 'hono';
import { escape } from 'sqlstring';
import {
  dateRangeSchema,
  getPeriodDates,
  getTimeSpanFromPeriod,
  pagePathParamSchema,
  paginationSchema,
} from '../schemas';
import type { ApiContextVars, ApiResponse, PaginatedResponse } from '../types';

interface PageStats {
  origin: string;
  pathname: string;
  pageViews: number;
  users: number;
}

interface SinglePageStats {
  path: string;
  views: number;
  users: number;
  avg_duration: number;
  bounce_rate: number;
}

export function createPagesRoutes(app: Hono<{ Variables: ApiContextVars }>) {
  // GET /stats/pages - Returns top pages with views and users
  app.get('/stats/pages', async (c) => {
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

      // Get most visited pages
      const pages = await clickhouseEvent.getMostVisitedPages(projectId, filterOptions);

      // Apply pagination
      const paginatedPages = pages.slice(offset, offset + limit);

      const response: PaginatedResponse<PageStats> = {
        data: paginatedPages.map((page) => ({
          origin: page.origin,
          pathname: page.pathname,
          pageViews: page.pageViews,
          users: page.users,
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
            total: pages.length,
          },
        },
      };

      return c.json(response);
    } catch (error) {
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch pages data',
          },
        },
        500,
      );
    }
  });

  // GET /stats/pages/:path - Returns single page stats (views, users, duration, bounce rate)
  app.get('/stats/pages/:path', async (c) => {
    // Validate path parameter
    const paramResult = pagePathParamSchema.safeParse(c.req.param());

    if (!paramResult.success) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid path parameter',
          },
        },
        400,
      );
    }

    const { path } = paramResult.data;

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
      // Query for single page stats
      const resultSet = await clickhouseClient.query({
      query: `
        WITH page_views AS (
          SELECT
            sessionId,
            count(*) as page_count,
            any(pathname) as pathname,
            max(createdAt) as last_view,
            min(createdAt) as first_view,
            count(DISTINCT userId) as users
          FROM event
          WHERE projectId = ${escape(projectId)}
            AND isPageView = 1
            AND pathname = ${escape(path)}
            AND createdAt >= '${formatClickhouseDate(startDate)}'
            ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
          GROUP BY sessionId
        ),
        session_data AS (
          SELECT
            pv.sessionId,
            s.duration,
            (SELECT count(*) FROM event e WHERE e.sessionId = pv.sessionId AND e.isPageView = 1) as total_page_views_in_session
          FROM page_views pv
          LEFT JOIN session s ON pv.sessionId = s.id AND s.projectId = ${escape(projectId)}
        )
        SELECT
          count(DISTINCT pv.sessionId) as views,
          count(DISTINCT (SELECT userId FROM event WHERE sessionId = pv.sessionId LIMIT 1)) as users,
          avg(sd.duration) as avg_duration,
          countIf(sd.total_page_views_in_session = 1) / count(DISTINCT pv.sessionId) * 100 as bounce_rate
        FROM page_views pv
        LEFT JOIN session_data sd ON pv.sessionId = sd.sessionId
      `,
      format: 'JSONEachRow',
    });

      const result = (await resultSet.json()) as Array<any>;

      if (result.length === 0) {
        return c.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'No data found for the specified page',
            },
          },
          404,
        );
      }

      const row = result[0];

      const stats: SinglePageStats = {
        path,
        views: Number(row.views),
        users: Number(row.users),
        avg_duration: Number(row.avg_duration) || 0,
        bounce_rate: Number(row.bounce_rate) || 0,
      };

      const response: ApiResponse<SinglePageStats> = {
        data: stats,
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
            message: 'Failed to fetch page stats',
          },
        },
        500,
      );
    }
  });
}
