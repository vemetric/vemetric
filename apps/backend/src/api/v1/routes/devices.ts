import { clickhouseEvent } from 'clickhouse';
import type { Hono } from 'hono';
import { getPeriodDates, statsQuerySchema } from '../schemas';
import type { ApiContextVars, ApiResponse } from '../types';

interface BrowserData {
  browserName: string;
  users: number;
}

interface DeviceData {
  deviceType: string;
  users: number;
}

interface OperatingSystemData {
  osName: string;
  users: number;
}

export function createDevicesRoutes(app: Hono<{ Variables: ApiContextVars }>) {
  // GET /stats/browsers - Browser breakdown
  app.get('/stats/browsers', async (c) => {
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
      // Fetch browsers data from ClickHouse
      const browsers = await clickhouseEvent.getBrowsers(projectId, {
        startDate: start,
        endDate: end,
        filterQueries: '',
        filterConfig: { operator: 'and', filters: [] },
      });

      // Format response
      const response: ApiResponse<BrowserData[]> = {
        data: browsers,
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
            message: 'Failed to fetch browser data',
          },
        },
        500,
      );
    }
  });

  // GET /stats/devices - Device type breakdown
  app.get('/stats/devices', async (c) => {
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
      // Fetch devices data from ClickHouse
      const devices = await clickhouseEvent.getDevices(projectId, {
        startDate: start,
        endDate: end,
        filterQueries: '',
        filterConfig: { operator: 'and', filters: [] },
      });

      // Format response
      const response: ApiResponse<DeviceData[]> = {
        data: devices,
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
            message: 'Failed to fetch device data',
          },
        },
        500,
      );
    }
  });

  // GET /stats/operating-systems - OS breakdown
  app.get('/stats/operating-systems', async (c) => {
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
      // Fetch operating systems data from ClickHouse
      const operatingSystems = await clickhouseEvent.getOperatingSystems(projectId, {
        startDate: start,
        endDate: end,
        filterQueries: '',
        filterConfig: { operator: 'and', filters: [] },
      });

      // Format response
      const response: ApiResponse<OperatingSystemData[]> = {
        data: operatingSystems,
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
            message: 'Failed to fetch operating system data',
          },
        },
        500,
      );
    }
  });
}
