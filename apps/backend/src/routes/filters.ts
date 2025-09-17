import { COUNTRIES } from '@vemetric/common/countries';
import { getEventName } from '@vemetric/common/event';
import { stringOperatorsSchema } from '@vemetric/common/filters';
import type { FunnelStep } from '@vemetric/common/funnel';
import { getNormalizedDomain } from '@vemetric/common/url';
import { clickhouseEvent } from 'clickhouse';
import { dbFunnel } from 'database';
import { addDays, differenceInDays, isAfter, startOfDay } from 'date-fns';
import { z } from 'zod';
import { projectOrPublicProcedure, router, timespanProcedure } from '../utils/trpc';

export const filtersRouter = router({
  getFilterableData: timespanProcedure.query(async (opts) => {
    const {
      ctx: { projectId, project, subscriptionStatus, startDate: _startDate, endDate: _endDate },
    } = opts;

    let startDate = _startDate;
    const endDate = _endDate;

    const minimumDayRange = subscriptionStatus.isActive ? -90 : -30;
    if (!endDate) {
      const minStartDate = addDays(startOfDay(new Date()), minimumDayRange);
      if (isAfter(startDate, minStartDate)) {
        startDate = minStartDate;
      }
    } else {
      const daysDiff = differenceInDays(startDate, endDate);
      if (daysDiff < minimumDayRange) {
        startDate = addDays(endDate, -minimumDayRange);
      }
    }

    const filterableData = await clickhouseEvent.getFilterableData(projectId, startDate, endDate);

    // Get funnels for the project
    const funnels = await dbFunnel.findByProjectId(project.id);

    return {
      funnels: funnels.map((f) => ({
        id: f.id,
        name: f.name,
        steps: (f.steps as Array<FunnelStep>).map((step: FunnelStep) => ({ id: step.id, name: step.name })),
      })),
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
