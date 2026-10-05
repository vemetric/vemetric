import type { z } from '@hono/zod-openapi';
import { COUNTRIES } from '@vemetric/common/countries';
import { getEventName } from '@vemetric/common/event';
import { clickhouseEvent } from 'clickhouse';
import { assertRetentionAllowed, type ApiServiceContext } from './context';
import type {
  filterValuesFieldSchema,
  filterValuesRequestSchema,
  filterValuesResponseSchema,
} from '../schemas/filter-values';
import { formatApiDate, resolveApiDateRange } from '../utils/date';

export type FilterValuesInput = z.output<typeof filterValuesRequestSchema>;
export type FilterValuesResult = z.output<typeof filterValuesResponseSchema>;

type FilterableData = Awaited<ReturnType<typeof clickhouseEvent.getFilterableData>>;

function sortStrings(values: string[]) {
  return [...values].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function getValuesForField(filterableData: FilterableData, field: z.output<typeof filterValuesFieldSchema>): string[] {
  switch (field) {
    case 'event:name':
      return [...filterableData.eventNames]
        .filter(Boolean)
        .sort((a, b) => getEventName(a).localeCompare(getEventName(b)));
    case 'page:path':
      return sortStrings(filterableData.pages.pathnames);
    case 'page:origin':
      return sortStrings(filterableData.pages.origins);
    case 'browser':
      return sortStrings(filterableData.pages.clientNames);
    case 'deviceType':
      return sortStrings(filterableData.pages.deviceTypes);
    case 'os':
      return sortStrings(filterableData.pages.osNames);
    case 'referrer':
      return sortStrings(filterableData.sources.referrers);
    case 'referrerType':
      return sortStrings(filterableData.sources.referrerTypes);
    case 'utmCampaign':
      return sortStrings(filterableData.sources.utmCampaigns);
    case 'utmContent':
      return sortStrings(filterableData.sources.utmContents);
    case 'utmMedium':
      return sortStrings(filterableData.sources.utmMediums);
    case 'utmSource':
      return sortStrings(filterableData.sources.utmSources);
    case 'utmTerm':
      return sortStrings(filterableData.sources.utmTerms);
    case 'country':
      return [...filterableData.sources.countryCodes]
        .filter(Boolean)
        .filter((c) => COUNTRIES[c as keyof typeof COUNTRIES])
        .sort((a, b) => {
          const countryA = COUNTRIES[a as keyof typeof COUNTRIES] || 'ZZ';
          const countryB = COUNTRIES[b as keyof typeof COUNTRIES] || 'ZZ';
          return countryA.localeCompare(countryB);
        });
    case 'city':
      return sortStrings(filterableData.sources.cities);
  }
}

export async function getFilterValues(ctx: ApiServiceContext, payload: FilterValuesInput): Promise<FilterValuesResult> {
  const projectId = BigInt(ctx.project.id);
  const { timespan, startDate, endDate } = resolveApiDateRange(payload.dateRange);
  assertRetentionAllowed(ctx, { timespan, startDate });

  const filterableData = await clickhouseEvent.getFilterableData(projectId, startDate, endDate);

  const data = payload.fields.map((field) => {
    const values = getValuesForField(filterableData, field);
    const pagedValues = values.slice(payload.offset, payload.offset + payload.limit);
    return {
      field,
      pagination: {
        limit: payload.limit,
        offset: payload.offset,
        returned: pagedValues.length,
      },
      values: pagedValues,
    };
  });

  return {
    period: {
      from: formatApiDate(startDate),
      to: formatApiDate(endDate ?? new Date()),
    },
    query: {
      dateRange: payload.dateRange,
      fields: payload.fields,
      limit: payload.limit,
      offset: payload.offset,
    },
    data,
  };
}
