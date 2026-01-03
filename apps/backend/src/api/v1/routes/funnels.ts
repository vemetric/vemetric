import type { FunnelStep } from '@vemetric/common/funnel';
import { clickhouseEvent } from 'clickhouse';
import { dbFunnel } from 'database';
import type { Hono } from 'hono';
import { logger } from '../../../utils/logger';
import { dateRangeSchema, funnelIdParamSchema, getPeriodDates } from '../schemas';
import type { ApiContextVars, ApiResponse } from '../types';

interface FunnelStepResult {
  step: number;
  users: number;
  conversion_rate: number;
}

interface FunnelData {
  id: string;
  name: string;
  icon: string | null;
  steps: FunnelStep[];
  results: FunnelStepResult[];
}

interface FunnelListItem {
  id: string;
  name: string;
  icon: string | null;
  total_conversion_rate: number;
}

export function createFunnelsRoutes(app: Hono<{ Variables: ApiContextVars }>) {
  // GET /funnels - List funnels with conversion rates
  app.get('/funnels', async (c) => {
    try {
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
      const { projectId, project } = apiContext;

      // Get date range
      const { start: startDate, end: endDate } = getPeriodDates(period, start_date, end_date);

      // Get all funnels for the project
      const funnels = await dbFunnel.findByProjectId(project.id);

      // Calculate conversion rates for each funnel
      const funnelsWithConversion = await Promise.all(
        funnels.map(async (funnel) => {
          const steps = funnel.steps as FunnelStep[];

          // Get funnel results from ClickHouse
          const funnelResults = await clickhouseEvent.getFunnelResults(
            projectId,
            steps,
            startDate,
            endDate,
            undefined, // windowHours
            '', // filterQueries
          );

          // Calculate total conversion rate (from first step to last step)
          let totalConversionRate = 0;
          if (funnelResults.length > 0) {
            const firstStepUsers = funnelResults[0]?.userCount ?? 0;
            const lastStepUsers = funnelResults[funnelResults.length - 1]?.userCount ?? 0;

            if (firstStepUsers > 0) {
              totalConversionRate = (lastStepUsers / firstStepUsers) * 100;
            }
          }

          return {
            id: funnel.id,
            name: funnel.name,
            icon: funnel.icon,
            total_conversion_rate: Math.round(totalConversionRate * 100) / 100,
          };
        }),
      );

      const response: ApiResponse<FunnelListItem[]> = {
        data: funnelsWithConversion,
        meta: {
          project_id: project.id,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          generated_at: new Date().toISOString(),
        },
      };

      return c.json(response);
    } catch (error) {
      logger.error({ error }, 'Error fetching funnels');
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch funnels',
          },
        },
        500,
      );
    }
  });

  // GET /funnels/:funnelId - Detailed funnel with step breakdown
  app.get('/funnels/:funnelId', async (c) => {
    try {
      // Validate path parameter
      const paramResult = funnelIdParamSchema.safeParse(c.req.param());

      if (!paramResult.success) {
        return c.json(
          {
            error: {
              code: 'INVALID_PARAMETERS',
              message: 'Invalid funnel ID',
            },
          },
          400,
        );
      }

      const { funnelId } = paramResult.data;

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
      const { projectId, project } = apiContext;

      // Get date range
      const { start: startDate, end: endDate } = getPeriodDates(period, start_date, end_date);

      // Get the funnel
      const funnel = await dbFunnel.findById(funnelId);

      if (!funnel || funnel.projectId !== project.id) {
        return c.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Funnel not found',
            },
          },
          404,
        );
      }

      const steps = funnel.steps as FunnelStep[];

      // Get funnel results from ClickHouse
      const funnelResults = await clickhouseEvent.getFunnelResults(
        projectId,
        steps,
        startDate,
        endDate,
        undefined, // windowHours
        '', // filterQueries
      );

      // Build step results with conversion rates
      const stepResults: FunnelStepResult[] = [];
      const firstStepUsers = funnelResults[0]?.userCount ?? 0;

      for (let i = 0; i < funnelResults.length; i++) {
        const stageResult = funnelResults[i];
        const users = stageResult?.userCount ?? 0;
        const conversionRate = firstStepUsers > 0 ? (users / firstStepUsers) * 100 : 0;

        stepResults.push({
          step: i + 1,
          users,
          conversion_rate: Math.round(conversionRate * 100) / 100,
        });
      }

      const data: FunnelData = {
        id: funnel.id,
        name: funnel.name,
        icon: funnel.icon,
        steps,
        results: stepResults,
      };

      const response: ApiResponse<FunnelData> = {
        data,
        meta: {
          project_id: project.id,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          generated_at: new Date().toISOString(),
        },
      };

      return c.json(response);
    } catch (error) {
      logger.error({ error }, 'Error fetching funnel details');
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch funnel details',
          },
        },
        500,
      );
    }
  });

  return app;
}
