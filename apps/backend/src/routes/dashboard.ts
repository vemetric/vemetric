import { TRPCError } from '@trpc/server';
import { isTimespanAllowed, TIME_SPAN_DATA, TIME_SPANS } from '@vemetric/common/charts/timespans';
import { filterConfigSchema } from '@vemetric/common/filters';
import { sourcesSchema } from '@vemetric/common/sources';
import { clickhouseEvent, clickhouseSession, getUserFilterQueries } from 'clickhouse';
import { z } from 'zod';
import { fillTimeSeries, getStartDate } from '../utils/timeseries';
import { projectOrPublicProcedure, router } from '../utils/trpc';

const timespanProcedure = projectOrPublicProcedure
  .input(z.object({ timespan: z.enum(TIME_SPANS) }))
  .use(async (opts) => {
    const {
      input,
      ctx: { subscriptionStatus },
    } = opts;

    if (!isTimespanAllowed(input.timespan, subscriptionStatus.isActive)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Upgrade to the Professional plan for longer data retention' });
    }

    return opts.next({
      ctx: opts.ctx,
    });
  });

export const dashboardRouter = router({
  getData: timespanProcedure
    .input(
      z.object({
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { timespan, filterConfig },
        ctx: { projectId, project, subscriptionStatus, isPublicDashboard },
      } = opts;

      const timeSpanData = TIME_SPAN_DATA[timespan];
      const startDate = getStartDate(timespan);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate });

      // Fetch all data in parallel
      const [
        pageViewTimeSeriesData,
        activeUserTimeSeriesData,
        bounceRateTimeSeriesData,
        visitDurationTimeSeriesData,
        currentActiveUsersData,
        usersData,
        mostVisitedPagesData,
        eventsData,
        eventsTimeSeriesData,
      ] = await Promise.all([
        clickhouseEvent.getPageViewTimeSeries(projectId, timespan, startDate, filterQueries, filterConfig),
        clickhouseEvent.getActiveUserTimeSeries(projectId, timespan, startDate, filterQueries),
        clickhouseEvent.getBounceRateTimeSeries(projectId, timespan, startDate, filterQueries),
        clickhouseSession.getVisitDurationTimeSeries(projectId, timespan, startDate, filterQueries),
        clickhouseEvent.getCurrentActiveUsers(projectId, filterQueries),
        clickhouseEvent.getActiveUsers(projectId, startDate, filterQueries),
        clickhouseEvent.getMostVisitedPages(projectId, startDate, filterQueries, filterConfig),
        clickhouseEvent.getEvents(projectId, startDate, filterQueries, filterConfig),
        clickhouseEvent.getEventsTimeSeries(projectId, timespan, startDate, filterQueries, filterConfig),
      ]);

      // Process the data after receiving all results
      const pageViewTimeSeries = fillTimeSeries(pageViewTimeSeriesData, startDate, timeSpanData.interval);
      const activeUserTimeSeries = fillTimeSeries(activeUserTimeSeriesData, startDate, timeSpanData.interval);
      const filledBounceRateTimeSeries = fillTimeSeries(bounceRateTimeSeriesData, startDate, timeSpanData.interval);
      const bounceRate = bounceRateTimeSeriesData?.length
        ? (bounceRateTimeSeriesData.reduce((sum, ts) => sum + ts.bounces, 0) /
            bounceRateTimeSeriesData.reduce((sum, ts) => sum + ts.totalSessions, 0)) *
          100
        : 0;
      const filledVisitDurationTimeSeries = fillTimeSeries(
        visitDurationTimeSeriesData,
        startDate,
        timeSpanData.interval,
      );
      const visitDuration = visitDurationTimeSeriesData?.length
        ? visitDurationTimeSeriesData.reduce((sum, ts) => sum + ts.count * ts.sessionCount, 0) /
          visitDurationTimeSeriesData.reduce((sum, ts) => sum + ts.sessionCount, 0)
        : 0;
      const eventsTimeSeries = fillTimeSeries(eventsTimeSeriesData, startDate, timeSpanData.interval);

      const chartTimeSeries =
        activeUserTimeSeries?.map((ts, index) => ({
          date: ts.date,
          users: ts.count,
          pageViews: pageViewTimeSeries?.[index]?.count || 0,
          bounceRate: filledBounceRateTimeSeries?.[index]?.count || 0,
          visitDuration: filledVisitDurationTimeSeries?.[index]?.count || 0,
          events: eventsTimeSeries?.[index]?.count || 0,
        })) ?? [];

      const pageViews = pageViewTimeSeries?.map((pv) => pv.count).reduce((a, b) => a + b, 0) ?? 0;
      const isInitialized =
        eventsData.length > 0 || pageViews > 0 || (await clickhouseEvent.getAllEventsCount(projectId)) > 0;

      return {
        isSubscriptionActive: subscriptionStatus.isActive,
        projectName: project?.name,
        projectDomain: project?.domain,
        projectToken: isPublicDashboard ? '' : project?.token,
        bounceRate,
        pageViews,
        chartTimeSeries,
        currentActiveUsers: currentActiveUsersData,
        users: usersData,
        mostVisitedPages: mostVisitedPagesData,
        events: eventsData,
        visitDuration,
        isInitialized,
      };
    }),
  getTopSources: timespanProcedure
    .input(
      z.object({
        filterConfig: filterConfigSchema,
        source: sourcesSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { timespan, filterConfig, source = 'referrer' },
        ctx: { projectId },
      } = opts;

      const startDate = getStartDate(timespan);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate });

      const topSourcesData = await clickhouseSession.getTopSources(
        projectId,
        startDate,
        source,
        filterQueries,
        filterConfig,
      );

      return {
        data: topSourcesData.filter((ts) => {
          if (source === 'referrerUrl') {
            return ts.referrer !== '';
          }
          return true;
        }),
        dataSource: source,
      };
    }),
  getCountries: timespanProcedure
    .input(
      z.object({
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { timespan, filterConfig },
        ctx: { projectId },
      } = opts;

      const startDate = getStartDate(timespan);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate });

      const countryCodes = await clickhouseSession.getCountryCodes(projectId, startDate, filterQueries, filterConfig);

      return {
        countryCodes,
      };
    }),
  getBrowsers: timespanProcedure
    .input(
      z.object({
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { timespan, filterConfig },
        ctx: { projectId },
      } = opts;

      const startDate = getStartDate(timespan);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate });

      const browsers = await clickhouseEvent.getBrowsers(projectId, startDate, filterQueries, filterConfig);

      return {
        browsers,
      };
    }),
  getDevices: timespanProcedure
    .input(
      z.object({
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { timespan, filterConfig },
        ctx: { projectId },
      } = opts;

      const startDate = getStartDate(timespan);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate });

      const devices = await clickhouseEvent.getDevices(projectId, startDate, filterQueries, filterConfig);

      return {
        devices,
      };
    }),
  getOperatingSystems: timespanProcedure
    .input(
      z.object({
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { timespan, filterConfig },
        ctx: { projectId },
      } = opts;

      const startDate = getStartDate(timespan);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate });

      const operatingSystems = await clickhouseEvent.getOperatingSystems(
        projectId,
        startDate,
        filterQueries,
        filterConfig,
      );

      return {
        operatingSystems,
      };
    }),
  getEventProperties: timespanProcedure
    .input(
      z.object({
        eventName: z.string(),
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { eventName, timespan, filterConfig },
        ctx: { projectId, isPublicDashboard },
      } = opts;

      if (isPublicDashboard) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Public dashboards do not support showing event properties',
        });
      }

      const startDate = getStartDate(timespan);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate });

      const properties = await clickhouseEvent.getEventProperties(
        projectId,
        eventName,
        startDate,
        filterQueries,
        filterConfig,
      );

      return {
        properties,
      };
    }),
  getPropertyValues: timespanProcedure
    .input(
      z.object({
        eventName: z.string(),
        property: z.string(),
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { eventName, property, timespan, filterConfig },
        ctx: { projectId, isPublicDashboard },
      } = opts;

      if (isPublicDashboard) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Public dashboards do not support showing event property values',
        });
      }

      const startDate = getStartDate(timespan);

      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate });

      const values = await clickhouseEvent.getPropertyValues(
        projectId,
        eventName,
        property,
        startDate,
        filterQueries,
        filterConfig,
      );

      return {
        values,
      };
    }),
});
