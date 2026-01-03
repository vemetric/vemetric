import type { IFilterConfig } from '@vemetric/common/filters';
import { clickhouseSession } from 'clickhouse';
import type { Hono } from 'hono';
import { getPeriodDates, statsQuerySchema } from '../schemas';
import type { ApiContextVars, ApiResponse } from '../types';

interface CountryData {
  countryCode: string;
  users: number;
}

export function createCountriesRoutes(app: Hono<{ Variables: ApiContextVars }>) {
  app.get('/stats/countries', async (c) => {
    // Get and validate query parameters
    const rawQuery = c.req.query();
    const queryResult = statsQuerySchema.safeParse(rawQuery);

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

    // Calculate date range
    const { start, end } = getPeriodDates(period, start_date, end_date);

    try {
      // Fetch country codes data from ClickHouse
      const countryCodes = await clickhouseSession.getCountryCodes(projectId, {
        startDate: start,
        endDate: end,
        filterQueries: '',
        filterConfig: { operator: 'and', filters: [] } as IFilterConfig,
      });

      // Format response
      const response: ApiResponse<CountryData[]> = {
        data: countryCodes,
        meta: {
          project_id: apiContext.project.id,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
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
            message: 'Failed to fetch country data',
          },
        },
        500,
      );
    }
  });
}
