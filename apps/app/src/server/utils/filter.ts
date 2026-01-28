import type { IFilterConfig } from '@vemetric/common/filters';
import type { FunnelStep } from '@vemetric/common/funnel';
import { dbFunnel } from 'database';

export const getFilterFunnelsData = async (projectId: string, filterConfig: IFilterConfig) => {
  const funnelsData = new Map<string, FunnelStep[]>();
  const hasFunnelFilterActive = filterConfig && filterConfig.filters.some((filter) => filter.type === 'funnel');
  if (hasFunnelFilterActive) {
    const funnels = await dbFunnel.findByProjectId(projectId);

    funnels.forEach((funnel) => {
      if (funnel && funnel.projectId === projectId) {
        funnelsData.set(funnel.id, funnel.steps as FunnelStep[]);
      }
    });
  }

  return funnelsData;
};
