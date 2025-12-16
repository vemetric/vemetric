import { getRouteApi } from '@tanstack/react-router';
import { z } from 'zod';

export const CHART_CATEGORY_KEYS = ['users', 'pageViews', 'bounceRate', 'visitDuration', 'events'] as const;
export type ChartCategoryKey = (typeof CHART_CATEGORY_KEYS)[number];

export const chartTogglesSchema = z.array(z.enum(CHART_CATEGORY_KEYS)).min(1).optional();

const DEFAULT_CHART_TOGGLES: ChartCategoryKey[] = ['users', 'pageViews'];

interface Props {
  publicDashboard?: boolean;
}

const isDefaultChartToggles = (toggles: ChartCategoryKey[]) => {
  return toggles.length === DEFAULT_CHART_TOGGLES.length && DEFAULT_CHART_TOGGLES.every((key) => toggles.includes(key));
};

export const useChartToggles = ({ publicDashboard }: Props) => {
  const route = getRouteApi(publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/');
  const navigate = route.useNavigate();
  const { ch: chartToggles } = route.useSearch() as { ch?: ChartCategoryKey[] };

  const activeCategoryKeys = chartToggles ?? DEFAULT_CHART_TOGGLES;
  const showEvents = activeCategoryKeys.includes('events');

  const toggleCategory = (category: ChartCategoryKey) => {
    let newToggles: ChartCategoryKey[];

    if (activeCategoryKeys.length === 1 && activeCategoryKeys[0] === category) {
      return;
    }

    if (activeCategoryKeys.includes(category)) {
      newToggles = activeCategoryKeys.filter((c) => c !== category);
    } else {
      newToggles = [...activeCategoryKeys, category];
    }

    navigate({
      from: publicDashboard ? '/public/$domain' : '/p/$projectId',
      search: (prev) => ({
        ...prev,
        ch: isDefaultChartToggles(newToggles) ? undefined : newToggles,
      }),
      params: (prev) => prev,
      resetScroll: false,
    });
  };

  return {
    activeCategoryKeys,
    showEvents,
    toggleCategory,
    isDefaultChartToggles,
  };
};
