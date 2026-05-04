import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { COUNTRIES } from '@vemetric/common/countries';
import { getEventName } from '@vemetric/common/event';
import { clickhouseEvent } from 'clickhouse';
import { isRetentionRestricted, RETENTION_UPGRADE_MESSAGE } from '../../utils/retention';
import {
  authorizationHeaderSchema,
  commonOpenApiErrorResponses,
  planLimitExceededOpenApiResponse,
} from '../schemas/common';
import { filterValuesRequestSchema, filterValuesResponseSchema } from '../schemas/filter-values';
import type { PublicApiHonoEnv } from '../types';
import { formatApiDate, resolveApiDateRange } from '../utils/date';
import { ApiError } from '../utils/errors';

const filterValuesRoute = createRoute({
  method: 'post',
  path: '/v1/filters/values',
  summary: 'Get filter values',
  description: 'Returns available filter values for one or more fields with pagination.',
  request: {
    headers: authorizationHeaderSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: filterValuesRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: filterValuesResponseSchema,
        },
      },
    },
    403: planLimitExceededOpenApiResponse,
    ...commonOpenApiErrorResponses,
  },
});

export function registerFilterValueRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(filterValuesRoute, async ({ req, json, var: { project, subscriptionStatus } }) => {
    const payload = req.valid('json');
    const projectId = BigInt(project.id);
    const { timespan, startDate, endDate } = resolveApiDateRange(payload.dateRange);

    if (
      isRetentionRestricted({
        timespan,
        startDate,
        isSubscriptionActive: subscriptionStatus.isActive,
      })
    ) {
      throw new ApiError(403, 'PLAN_LIMIT_EXCEEDED', RETENTION_UPGRADE_MESSAGE);
    }

    const filterableData = await clickhouseEvent.getFilterableData(projectId, startDate, endDate);

    const getValuesForField = (field: (typeof payload.fields)[number]): string[] => {
      const sortStrings = (values: string[]) => [...values].filter(Boolean).sort((a, b) => a.localeCompare(b));

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
    };

    const data = payload.fields.map((field) => {
      const values = getValuesForField(field);
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

    return json(
      {
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
      },
      200,
    );
  });
}
