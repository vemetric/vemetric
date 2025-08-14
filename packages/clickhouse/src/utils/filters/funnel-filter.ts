import type { IFunnelFilter } from '@vemetric/common/filters';
import type { FunnelStep } from '@vemetric/common/funnel';
import { escape } from 'sqlstring';
import { buildFunnelStepConditions, buildWindowFunnelSubquery } from '../funnel';

export const buildFunnelFilterQuery = (
  filter: IFunnelFilter,
  projectId: bigint,
  funnelSteps: FunnelStep[],
  startDate?: Date,
): string | null => {
  const { step, operator } = filter;

  if (step >= funnelSteps.length) {
    return null;
  }

  // Build conditions for each step up to and including the target step
  const stepsToCheck = funnelSteps.slice(0, step + 1);
  const stepConditions = buildFunnelStepConditions(stepsToCheck, projectId);
  const funnelSubquery = buildWindowFunnelSubquery(projectId, stepConditions, startDate);

  const funnelQuery = `
    (SELECT userId
     FROM (${funnelSubquery})
     WHERE maxStage >= ${escape(step + 1)})
  `;

  if (operator === 'completed') {
    return `userId IN ${funnelQuery}`;
  } else {
    return `userId NOT IN ${funnelQuery}`;
  }
};
