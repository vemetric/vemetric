import { formatClickhouseDate } from '@vemetric/common/date';
import type { FunnelStep } from '@vemetric/common/funnel';
import { escape } from 'sqlstring';
import { buildEventFilterQuery } from './filters/event-filter';
import { buildPageFilterQuery } from './filters/page-filter';

/**
 * Builds step condition queries for funnel analysis
 */
export const buildFunnelStepConditions = (steps: FunnelStep[], projectId: bigint): string[] => {
  return steps.map((step) => {
    const conditions = [`projectId = ${escape(projectId)}`];

    if (step.filter.type === 'page') {
      conditions.push('isPageView = 1');
      const pageFilterQuery = buildPageFilterQuery(step.filter);
      if (pageFilterQuery) {
        conditions.push(pageFilterQuery);
      }
    } else {
      conditions.push('isPageView = 0');
      const eventFilterQuery = buildEventFilterQuery(step.filter);
      if (eventFilterQuery) {
        conditions.push(eventFilterQuery);
      }
    }

    return conditions.join(' AND ');
  });
};

/**
 * Generates a windowFunnel subquery for funnel analysis
 */
export const buildWindowFunnelSubquery = (
  projectId: bigint,
  stepConditions: string[],
  startDate?: Date,
  windowHours: number = 168,
): string => {
  return `
    SELECT 
      userId,
      windowFunnel(${escape(windowHours * 60 * 60)})(
        toDateTime(createdAt),
        ${stepConditions.map((condition) => `(${condition})`).join(',')}
      ) as maxStage
    FROM event
    WHERE projectId = ${escape(projectId)}
      ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
    GROUP BY userId
  `;
};
