import { clickhouseEvent, clickhouseSession } from 'clickhouse';
import type { Hono } from 'hono';
import { logger } from '../../../utils/logger';
import {
  dateRangeSchema,
  getIntervalFromPeriod,
  getPeriodDates,
  getTimeSpanFromPeriod,
  timeseriesQuerySchema,
} from '../schemas';
import type { ApiContextVars, ApiResponse } from '../types';

interface OverviewData {
  pageviews: number;
  active_users: number;
  online_users: number;
  bounce_rate: number;
  avg_duration: number;
}

interface TimeSeriesDataPoint {
  date: string;
  [key: string]: number | string;
}

interface TimeSeriesData {
  interval: string;
  metrics: string[];
  data: TimeSeriesDataPoint[];
}

export function createOverviewRoutes(app: Hono<{ Variables: ApiContextVars }>) {
  // GET /stats/overview - Returns total pageviews, active users, online users, bounce rate, avg duration
  app.get('/stats/overview', async (c) => {
    try {
      // Validate query parameters
      const queryParams = c.req.query();
      const validatedQuery = dateRangeSchema.parse({
        period: queryParams.period,
        start_date: queryParams.start_date,
        end_date: queryParams.end_date,
      });

      // Get dates from period
      const { start, end } = getPeriodDates(
        validatedQuery.period,
        validatedQuery.start_date,
        validatedQuery.end_date,
      );

      // Get project context
      const { projectId, project } = c.get('api');

      // Build filter options
      const filterOptions = {
        timeSpan: getTimeSpanFromPeriod(validatedQuery.period),
        startDate: start,
        endDate: end,
        filterQueries: '',
        filterConfig: { operator: 'and' as const, filters: [] },
      };

      // Fetch all metrics in parallel
      const [
        pageViewTimeSeriesData,
        activeUsersData,
        onlineUsersData,
        bounceRateTimeSeriesData,
        visitDurationTimeSeriesData,
      ] = await Promise.all([
        clickhouseEvent.getPageViewTimeSeries(projectId, filterOptions),
        clickhouseEvent.getActiveUsers(projectId, {
          startDate: start,
          endDate: end,
          filterQueries: '',
        }),
        clickhouseEvent.getCurrentActiveUsers(projectId, ''),
        clickhouseEvent.getBounceRateTimeSeries(projectId, filterOptions),
        clickhouseSession.getVisitDurationTimeSeries(projectId, filterOptions),
      ]);

      // Calculate aggregate metrics
      const pageviews = pageViewTimeSeriesData?.reduce((sum, ts) => sum + ts.count, 0) ?? 0;

      const bounceRate = bounceRateTimeSeriesData?.length
        ? (bounceRateTimeSeriesData.reduce((sum, ts) => sum + ts.bounces, 0) /
            bounceRateTimeSeriesData.reduce((sum, ts) => sum + ts.totalSessions, 0)) *
          100
        : 0;

      const avgDuration = visitDurationTimeSeriesData?.length
        ? visitDurationTimeSeriesData.reduce((sum, ts) => sum + ts.count * ts.sessionCount, 0) /
          visitDurationTimeSeriesData.reduce((sum, ts) => sum + ts.sessionCount, 0)
        : 0;

      const data: OverviewData = {
        pageviews,
        active_users: activeUsersData ?? 0,
        online_users: onlineUsersData ?? 0,
        bounce_rate: Math.round(bounceRate * 100) / 100, // Round to 2 decimal places
        avg_duration: Math.round(avgDuration), // Round to nearest second
      };

      const response: ApiResponse<OverviewData> = {
        data,
        meta: {
          project_id: project.id,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
          generated_at: new Date().toISOString(),
        },
      };

      return c.json(response, 200);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
            },
          },
          400,
        );
      }

      logger.error({ error }, 'Error fetching overview stats');
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch overview statistics',
          },
        },
        500,
      );
    }
  });

  // GET /stats/timeseries - Returns time series data with configurable metrics and interval
  app.get('/stats/timeseries', async (c) => {
    try {
      // Validate query parameters
      const queryParams = c.req.query();
      const validatedQuery = timeseriesQuerySchema.parse({
        period: queryParams.period,
        start_date: queryParams.start_date,
        end_date: queryParams.end_date,
        metrics: queryParams.metrics ? (Array.isArray(queryParams.metrics) ? queryParams.metrics : [queryParams.metrics]) : undefined,
        interval: queryParams.interval,
      });

      // Get dates from period
      const { start, end } = getPeriodDates(
        validatedQuery.period,
        validatedQuery.start_date,
        validatedQuery.end_date,
      );

      // Get project context
      const { projectId, project } = c.get('api');

      // Determine interval
      const interval = validatedQuery.interval || getIntervalFromPeriod(validatedQuery.period);

      // Default metrics if not specified
      const requestedMetrics = validatedQuery.metrics || ['pageviews', 'users', 'sessions'];

      // Build filter options
      const filterOptions = {
        timeSpan: getTimeSpanFromPeriod(validatedQuery.period),
        startDate: start,
        endDate: end,
        filterQueries: '',
        filterConfig: { operator: 'and' as const, filters: [] },
      };

      // Fetch requested time series data in parallel
      const timeSeriesPromises: Promise<any[]>[] = [];

      if (requestedMetrics.includes('pageviews')) {
        timeSeriesPromises.push(clickhouseEvent.getPageViewTimeSeries(projectId, filterOptions));
      }

      if (requestedMetrics.includes('users')) {
        timeSeriesPromises.push(clickhouseEvent.getActiveUserTimeSeries(projectId, filterOptions));
      }

      if (requestedMetrics.includes('sessions')) {
        timeSeriesPromises.push(clickhouseEvent.getActiveUserTimeSeries(projectId, filterOptions));
      }

      if (requestedMetrics.includes('bounce_rate')) {
        timeSeriesPromises.push(clickhouseEvent.getBounceRateTimeSeries(projectId, filterOptions));
      }

      if (requestedMetrics.includes('duration')) {
        timeSeriesPromises.push(clickhouseSession.getVisitDurationTimeSeries(projectId, filterOptions));
      }

      const results = await Promise.all(timeSeriesPromises);

      // Build time series data structure
      const dataMap = new Map<string, TimeSeriesDataPoint>();
      let resultIndex = 0;

      if (requestedMetrics.includes('pageviews')) {
        const pageViewData = results[resultIndex++];
        pageViewData?.forEach((item: any) => {
          const dateKey = new Date(item.date).toISOString();
          if (!dataMap.has(dateKey)) {
            dataMap.set(dateKey, { date: dateKey });
          }
          dataMap.get(dateKey)!.pageviews = item.count;
        });
      }

      if (requestedMetrics.includes('users')) {
        const usersData = results[resultIndex++];
        usersData?.forEach((item: any) => {
          const dateKey = new Date(item.date).toISOString();
          if (!dataMap.has(dateKey)) {
            dataMap.set(dateKey, { date: dateKey });
          }
          dataMap.get(dateKey)!.users = item.count;
        });
      }

      if (requestedMetrics.includes('sessions')) {
        const sessionsData = results[resultIndex++];
        sessionsData?.forEach((item: any) => {
          const dateKey = new Date(item.date).toISOString();
          if (!dataMap.has(dateKey)) {
            dataMap.set(dateKey, { date: dateKey });
          }
          dataMap.get(dateKey)!.sessions = item.count;
        });
      }

      if (requestedMetrics.includes('bounce_rate')) {
        const bounceRateData = results[resultIndex++];
        bounceRateData?.forEach((item: any) => {
          const dateKey = new Date(item.date).toISOString();
          if (!dataMap.has(dateKey)) {
            dataMap.set(dateKey, { date: dateKey });
          }
          const bounceRate = item.totalSessions > 0 ? (item.bounces / item.totalSessions) * 100 : 0;
          dataMap.get(dateKey)!.bounce_rate = Math.round(bounceRate * 100) / 100;
        });
      }

      if (requestedMetrics.includes('duration')) {
        const durationData = results[resultIndex++];
        durationData?.forEach((item: any) => {
          const dateKey = new Date(item.date).toISOString();
          if (!dataMap.has(dateKey)) {
            dataMap.set(dateKey, { date: dateKey });
          }
          const avgDuration = item.sessionCount > 0 ? item.count / item.sessionCount : 0;
          dataMap.get(dateKey)!.duration = Math.round(avgDuration);
        });
      }

      // Convert map to sorted array
      const timeSeriesArray = Array.from(dataMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const data: TimeSeriesData = {
        interval,
        metrics: requestedMetrics,
        data: timeSeriesArray,
      };

      const response: ApiResponse<TimeSeriesData> = {
        data,
        meta: {
          project_id: project.id,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
          generated_at: new Date().toISOString(),
        },
      };

      return c.json(response, 200);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
            },
          },
          400,
        );
      }

      logger.error({ error }, 'Error fetching timeseries stats');
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch timeseries statistics',
          },
        },
        500,
      );
    }
  });

  return app;
}
