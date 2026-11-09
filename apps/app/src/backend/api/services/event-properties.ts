import type { z } from '@hono/zod-openapi';
import { clickhouseEvent, getUserFilterQueries } from 'clickhouse';
import { assertRetentionAllowed, type ApiServiceContext } from './context';
import { getFilterFunnelsData } from '../../utils/filter';
import type { eventPropertiesRequestSchema, eventPropertiesResponseSchema } from '../schemas/event-properties';
import { mapApiFilterConfig } from '../utils/api-to-internal-filter-mapper';
import { formatApiDate, resolveApiDateRange } from '../utils/date';

export type EventPropertiesInput = z.output<typeof eventPropertiesRequestSchema>;
export type EventPropertiesResult = z.output<typeof eventPropertiesResponseSchema>;

export async function listEventProperties(
  ctx: ApiServiceContext,
  payload: EventPropertiesInput,
): Promise<EventPropertiesResult> {
  const { project } = ctx;
  const projectId = BigInt(project.id);

  const { timespan, startDate, endDate } = resolveApiDateRange(payload.dateRange);
  assertRetentionAllowed(ctx, { timespan, startDate });

  const filterConfig = mapApiFilterConfig(payload.filters, payload.filtersOperator);
  const funnelsData = filterConfig ? await getFilterFunnelsData(project.id, filterConfig) : null;
  const { filterQueries } = getUserFilterQueries({
    filterConfig,
    projectId,
    startDate,
    endDate,
    funnelsData: funnelsData ?? new Map(),
  });

  const properties = await clickhouseEvent.getPropertiesOfEvents(projectId, payload.eventNames, {
    startDate,
    endDate,
    filterQueries,
    filterConfig,
  });

  return {
    period: {
      from: formatApiDate(startDate),
      to: formatApiDate(endDate ?? new Date()),
    },
    query: {
      eventNames: payload.eventNames,
      dateRange: payload.dateRange,
      ...(payload.filters ? { filters: payload.filters, filtersOperator: payload.filtersOperator } : {}),
      limit: payload.limit,
      offset: payload.offset,
    },
    data: payload.eventNames.map((eventName) => {
      const pagedProperties = properties
        .filter((property) => property.eventName === eventName)
        .slice(payload.offset, payload.offset + payload.limit);
      return {
        eventName,
        pagination: {
          limit: payload.limit,
          offset: payload.offset,
          returned: pagedProperties.length,
        },
        properties: pagedProperties.map((property) => ({
          name: property.name,
          events: property.count,
          users: property.users,
        })),
      };
    }),
  };
}
