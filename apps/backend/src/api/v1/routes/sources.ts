import type { ISources } from '@vemetric/common/sources';
import { clickhouseSession } from 'clickhouse';
import type { Hono } from 'hono';
import { getPeriodDates, sourcesQuerySchema } from '../schemas';
import type { ApiContextVars, ApiResponse } from '../types';

interface SourceData {
  referrer: string;
  referrerUrl: string;
  referrerType: string;
  utmCampaign: string;
  utmContent: string;
  utmMedium: string;
  utmSource: string;
  utmTerm: string;
  users: number;
}

export function createSourcesRoutes(app: Hono<{ Variables: ApiContextVars }>) {
  // GET /stats/sources - Get traffic sources
  app.get('/stats/sources', async (c) => {
    // Get and validate query parameters
    const rawQuery = c.req.query();
    const queryResult = sourcesQuerySchema.safeParse(rawQuery);

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

    const { period, start_date, end_date, source } = queryResult.data;
    const apiContext = c.get('api');
    const projectId = apiContext.projectId;

    // Get date range
    const { start, end } = getPeriodDates(period, start_date, end_date);

    try {
      // Fetch sources data from ClickHouse
      const sources = await clickhouseSession.getTopSources(projectId, source as ISources, {
        startDate: start,
        endDate: end,
        filterQueries: '',
        filterConfig: { operator: 'and', filters: [] },
      });

      // Format response
      const response: ApiResponse<SourceData[]> = {
        data: sources,
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
    } catch {
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch sources data',
          },
        },
        500,
      );
    }
  });
}
