import { COUNTRIES } from '@vemetric/common/countries';
import { getEventName } from '@vemetric/common/event';
import { stringOperatorsSchema } from '@vemetric/common/filters';
import type { FunnelStep } from '@vemetric/common/funnel';
import { getNormalizedDomain } from '@vemetric/common/url';
import { clickhouseEvent } from 'clickhouse';
import { dbFunnel } from 'database';
import { addDays, differenceInDays, isAfter, startOfDay } from 'date-fns';
import { z } from 'zod';
import { projectOrPublicProcedure, publicTimespanProcedure, router } from '../utils/trpc';

export const filtersRouter = router({
  getFilterableData: publicTimespanProcedure.query(async (opts) => {
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
      pagePaths: filterableData.pages.pathnames.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      origins: filterableData.pages.origins.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      browserNames: filterableData.pages.clientNames.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      deviceTypes: filterableData.pages.deviceTypes.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      osNames: filterableData.pages.osNames.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      referrers: filterableData.sources.referrers.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      referrerUrls: filterableData.sources.referrerUrls
        .filter(Boolean)
        .filter((url) => {
          if (!project) {
            return true;
          }

          const resolvedDomain = getNormalizedDomain(url);
          return !resolvedDomain.endsWith(project.domain);
        })
        .sort((a, b) => a.localeCompare(b)),
      utmCampaigns: filterableData.sources.utmCampaigns.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      utmContents: filterableData.sources.utmContents.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      utmMediums: filterableData.sources.utmMediums.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      utmSources: filterableData.sources.utmSources.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      utmTerms: filterableData.sources.utmTerms.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      countryCodes: filterableData.sources.countryCodes.filter(Boolean).sort((a, b) => {
        const countryA = COUNTRIES[a as keyof typeof COUNTRIES] || 'ZZ';
        const countryB = COUNTRIES[b as keyof typeof COUNTRIES] || 'ZZ';
        return countryA.localeCompare(countryB);
      }),
      cities: filterableData.sources.cities.filter(Boolean).sort((a, b) => a.localeCompare(b)),
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
