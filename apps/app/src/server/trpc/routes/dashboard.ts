import { TRPCError } from '@trpc/server';
import { filterConfigSchema } from '@vemetric/common/filters';
import type { FunnelStep } from '@vemetric/common/funnel';
import { sourcesSchema } from '@vemetric/common/sources';
import { clickhouseEvent, clickhouseSession, getUserFilterQueries, type FilterOptions } from 'clickhouse';
import { dbFunnel } from 'database';
import { z } from 'zod';
import { getFilterFunnelsData } from '../../utils/filter';
import { fillTimeSeries, getPreviousPeriodDates } from '../../utils/timeseries';
import { timespanProcedure, router } from '../trpc';

async function fetchMetricsData(projectId: bigint, filterOptions: FilterOptions) {
  const { startDate, endDate, filterQueries } = filterOptions;

  const [pageViewTimeSeriesData, usersData, bounceRateTimeSeriesData, visitDurationTimeSeriesData] = await Promise.all([
    clickhouseEvent.getPageViewTimeSeries(projectId, filterOptions),
    clickhouseEvent.getActiveUsers(projectId, { startDate, endDate, filterQueries }),
    clickhouseEvent.getBounceRateTimeSeries(projectId, filterOptions),
    clickhouseSession.getVisitDurationTimeSeries(projectId, filterOptions),
  ]);

  const pageViews = pageViewTimeSeriesData?.reduce((sum, ts) => sum + ts.count, 0) ?? 0;
  const bounceRate = bounceRateTimeSeriesData?.length
    ? (bounceRateTimeSeriesData.reduce((sum, ts) => sum + ts.bounces, 0) /
        bounceRateTimeSeriesData.reduce((sum, ts) => sum + ts.totalSessions, 0)) *
      100
    : 0;
  const visitDuration = visitDurationTimeSeriesData?.length
    ? visitDurationTimeSeriesData.reduce((sum, ts) => sum + ts.count * ts.sessionCount, 0) /
      visitDurationTimeSeriesData.reduce((sum, ts) => sum + ts.sessionCount, 0)
    : 0;

  return {
    users: usersData ?? 0,
    pageViews,
    bounceRate,
    visitDuration,
    // Return raw time series data for getData to use for chart
    pageViewTimeSeriesData,
    bounceRateTimeSeriesData,
    visitDurationTimeSeriesData,
  };
}

export const dashboardRouter = router({
  getData: timespanProcedure
    .input(
      z.object({
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { timespan: timeSpan, filterConfig },
        ctx: { projectId, project, subscriptionStatus, isPublicDashboard, startDate, endDate, timeSpanData },
      } = opts;

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const filterOptions = {
        timeSpan,
        startDate,
        endDate,
        filterQueries,
        filterConfig,
      };

      // Fetch all data in parallel
      const [
        metricsData,
        activeUserTimeSeriesData,
        currentActiveUsersData,
        mostVisitedPagesData,
        eventsData,
        eventsTimeSeriesData,
      ] = await Promise.all([
        fetchMetricsData(projectId, filterOptions),
        clickhouseEvent.getActiveUserTimeSeries(projectId, filterOptions),
        clickhouseEvent.getCurrentActiveUsers(projectId, filterQueries),
        clickhouseEvent.getMostVisitedPages(projectId, filterOptions),
        clickhouseEvent.getEvents(projectId, filterOptions),
        clickhouseEvent.getEventsTimeSeries(projectId, filterOptions),
      ]);

      // Process the data after receiving all results
      const pageViewTimeSeries = fillTimeSeries(
        metricsData.pageViewTimeSeriesData,
        startDate,
        timeSpanData.interval,
        endDate,
      );
      const activeUserTimeSeries = fillTimeSeries(activeUserTimeSeriesData, startDate, timeSpanData.interval, endDate);
      const filledBounceRateTimeSeries = fillTimeSeries(
        metricsData.bounceRateTimeSeriesData,
        startDate,
        timeSpanData.interval,
        endDate,
      );
      const filledVisitDurationTimeSeries = fillTimeSeries(
        metricsData.visitDurationTimeSeriesData,
        startDate,
        timeSpanData.interval,
        endDate,
      );
      const eventsTimeSeries = fillTimeSeries(eventsTimeSeriesData, startDate, timeSpanData.interval, endDate);

      const chartTimeSeries =
        activeUserTimeSeries?.map((ts, index) => ({
          date: ts.date,
          users: ts.count,
          pageViews: pageViewTimeSeries?.[index]?.count || 0,
          bounceRate: filledBounceRateTimeSeries?.[index]?.count || 0,
          visitDuration: filledVisitDurationTimeSeries?.[index]?.count || 0,
          events: eventsTimeSeries?.[index]?.count || 0,
        })) ?? [];

      const isInitialized =
        eventsData.length > 0 || metricsData.pageViews > 0 || (await clickhouseEvent.getAllEventsCount(projectId)) > 0;

      return {
        isSubscriptionActive: subscriptionStatus.isActive,
        projectName: project?.name,
        projectDomain: project?.domain,
        projectToken: isPublicDashboard ? '' : project?.token,
        bounceRate: metricsData.bounceRate,
        pageViews: metricsData.pageViews,
        chartTimeSeries,
        currentActiveUsers: currentActiveUsersData,
        users: metricsData.users,
        mostVisitedPages: mostVisitedPagesData,
        events: eventsData,
        visitDuration: metricsData.visitDuration,
        isInitialized,
      };
    }),
  getPreviousData: timespanProcedure
    .input(
      z.object({
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { timespan: timeSpan, filterConfig },
        ctx: { projectId, project, startDate, endDate },
      } = opts;

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);

      // Calculate previous period dates
      const currentEndDate = endDate ?? new Date();
      const { prevStartDate, prevEndDate } = getPreviousPeriodDates(startDate, currentEndDate);
      const { filterQueries } = getUserFilterQueries({
        filterConfig,
        projectId,
        startDate: prevStartDate,
        endDate: prevEndDate,
        funnelsData,
      });

      const metricsData = await fetchMetricsData(projectId, {
        timeSpan,
        startDate: prevStartDate,
        endDate: prevEndDate,
        filterQueries,
        filterConfig,
      });

      return {
        users: metricsData.users,
        pageViews: metricsData.pageViews,
        bounceRate: metricsData.bounceRate,
        visitDuration: metricsData.visitDuration,
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
        input: { filterConfig, source = 'referrer' },
        ctx: { projectId, project, startDate, endDate },
      } = opts;

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const topSourcesData = await clickhouseSession.getTopSources(projectId, source, {
        startDate,
        endDate,
        filterQueries,
        filterConfig,
      });

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
        input: { filterConfig },
        ctx: { projectId, project, startDate, endDate },
      } = opts;

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const countryCodes = await clickhouseSession.getCountryCodes(projectId, {
        startDate,
        endDate,
        filterQueries,
        filterConfig,
      });

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
        input: { filterConfig },
        ctx: { projectId, project, startDate, endDate },
      } = opts;

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const browsers = await clickhouseEvent.getBrowsers(projectId, {
        startDate,
        endDate,
        filterQueries,
        filterConfig,
      });

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
        input: { filterConfig },
        ctx: { projectId, project, startDate, endDate },
      } = opts;

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const devices = await clickhouseEvent.getDevices(projectId, { startDate, endDate, filterQueries, filterConfig });

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
        input: { filterConfig },
        ctx: { projectId, project, startDate, endDate },
      } = opts;

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const operatingSystems = await clickhouseEvent.getOperatingSystems(projectId, {
        startDate,
        endDate,
        filterQueries,
        filterConfig,
      });

      return {
        operatingSystems,
      };
    }),
  getFunnels: timespanProcedure
    .input(
      z.object({
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { filterConfig },
        ctx: { projectId, project, startDate, endDate },
      } = opts;

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const filteredFunnelIds =
        filterConfig?.filters.filter((filter) => filter.type === 'funnel').map((filter) => filter.id) ?? [];
      const funnels = await dbFunnel.findByProjectId(project.id);
      const filteredFunnels = funnels.filter(
        (funnel) => filteredFunnelIds.length < 1 || filteredFunnelIds.includes(funnel.id),
      );

      const funnelsWithResults = await Promise.all(
        filteredFunnels.map(async (funnel) => {
          const steps = funnel.steps as FunnelStep[];
          const funnelResults = await clickhouseEvent.getFunnelResults(
            projectId,
            steps,
            startDate,
            endDate,
            undefined,
            filterQueries,
          );

          const firstStepUsers = funnelResults[0]?.userCount || 0;
          const lastStepUsers = funnelResults[steps.length - 1]?.userCount || 0;
          const conversionRate = firstStepUsers > 0 ? (lastStepUsers / firstStepUsers) * 100 : 0;

          return {
            id: funnel.id,
            name: funnel.name,
            icon: funnel.icon,
            steps,
            conversionRate,
            completedUsers: lastStepUsers,
            firstStepUsers,
          };
        }),
      );

      return {
        funnels: funnelsWithResults.sort((a, b) => b.conversionRate - a.conversionRate),
      };
    }),
  getFunnelSteps: timespanProcedure
    .input(
      z.object({
        funnelId: z.string(),
        filterConfig: filterConfigSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { funnelId, filterConfig },
        ctx: { projectId, project, startDate, endDate },
      } = opts;

      const funnel = await dbFunnel.findById(funnelId);
      if (!funnel || funnel.projectId !== project.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Funnel not found' });
      }

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const steps = funnel.steps as FunnelStep[];
      const funnelResults = await clickhouseEvent.getFunnelResults(
        projectId,
        steps,
        startDate,
        endDate,
        undefined,
        filterQueries,
      );

      const stepResults = steps.map((step, index) => ({
        name: step.name,
        users: funnelResults[index]?.userCount || 0,
      }));

      return {
        funnel: {
          id: funnel.id,
          name: funnel.name,
          icon: funnel.icon,
          steps,
        },
        stepResults,
        firstStepUsers: funnelResults[0]?.userCount || 0,
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
        input: { eventName, filterConfig },
        ctx: { projectId, project, startDate, endDate, isPublicDashboard },
      } = opts;

      if (isPublicDashboard) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Public dashboards do not support showing event properties',
        });
      }

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const properties = await clickhouseEvent.getEventProperties(projectId, eventName, {
        startDate,
        endDate,
        filterQueries,
        filterConfig,
      });

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
        input: { eventName, property, filterConfig },
        ctx: { projectId, project, startDate, endDate, isPublicDashboard },
      } = opts;

      if (isPublicDashboard) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Public dashboards do not support showing event property values',
        });
      }

      const funnelsData = await getFilterFunnelsData(project.id, filterConfig);
      const { filterQueries } = getUserFilterQueries({ filterConfig, projectId, startDate, endDate, funnelsData });

      const values = await clickhouseEvent.getPropertyValues(projectId, eventName, property, {
        startDate,
        endDate,
        filterQueries,
        filterConfig,
      });

      return {
        values,
      };
    }),
});
