import { isTimespanAllowed, TIME_SPANS } from '@vemetric/common/charts/timespans';
import { COUNTRIES } from '@vemetric/common/countries';
import { getEventName } from '@vemetric/common/event';
import { stringOperatorsSchema } from '@vemetric/common/filters';
import { getNormalizedDomain } from '@vemetric/common/url';
import { clickhouseEvent } from 'clickhouse';
import { addDays, startOfDay } from 'date-fns';
import { z } from 'zod';
import { getStartDate } from '../utils/timeseries';
import { projectOrPublicProcedure, router } from '../utils/trpc';

export const filtersRouter = router({
  getFilterableData: projectOrPublicProcedure
    .input(z.object({ timespan: z.enum(TIME_SPANS).optional() }))
    .query(async (opts) => {
      const {
        input: { timespan },
        ctx: { projectId, project, subscriptionStatus },
      } = opts;

      const timespanStartDate =
        timespan && isTimespanAllowed(timespan, subscriptionStatus.isActive) ? getStartDate(timespan) : null;
      const startDate = timespanStartDate ?? addDays(startOfDay(new Date()), subscriptionStatus.isActive ? -90 : -30);

      const filterableData = await clickhouseEvent.getFilterableData(projectId, startDate);

      return {
        eventNames: filterableData.eventNames.sort((a, b) => {
          const eventNameA = getEventName(a);
          const eventNameB = getEventName(b);
          return eventNameA.localeCompare(eventNameB);
        }),
        pagePaths: filterableData.pages[0].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        origins: filterableData.pages[1].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        browserNames: filterableData.pages[2].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        deviceTypes: filterableData.pages[3].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        osNames: filterableData.pages[4].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        referrers: filterableData.sources[0].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        referrerUrls: filterableData.sources[1]
          .filter(Boolean)
          .filter((url) => {
            if (!project) {
              return true;
            }

            const resolvedDomain = getNormalizedDomain(url);
            return !resolvedDomain.endsWith(project.domain);
          })
          .sort((a, b) => a.localeCompare(b)),
        utmCampaigns: filterableData.sources[2].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        utmContents: filterableData.sources[3].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        utmMediums: filterableData.sources[4].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        utmSources: filterableData.sources[5].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        utmTerms: filterableData.sources[6].filter(Boolean).sort((a, b) => a.localeCompare(b)),
        countryCodes: filterableData.sources[7].filter(Boolean).sort((a, b) => {
          const countryA = COUNTRIES[a as keyof typeof COUNTRIES] || 'ZZ';
          const countryB = COUNTRIES[b as keyof typeof COUNTRIES] || 'ZZ';
          return countryA.localeCompare(countryB);
        }),
      };
    }),

  getEventPropertiesWithValues: projectOrPublicProcedure
    .input(
      z.object({
        eventName: z.string(),
        operator: stringOperatorsSchema,
      }),
    )
    .query(async (opts) => {
      const {
        input: { eventName, operator },
        ctx: { projectId, subscriptionStatus },
      } = opts;

      if (!eventName) {
        return {};
      }

      // Get data from the last 90 days for active subscriptions, 30 days for free tier
      const startDate = addDays(startOfDay(new Date()), subscriptionStatus.isActive ? -90 : -30);

      // Use the new efficient function with operator
      return await clickhouseEvent.getEventPropertiesAndValues(projectId, eventName, startDate, operator);
    }),
});
