import { getRouteApi } from '@tanstack/react-router';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { useEffect } from 'react';
import { getStoredTimespanData, setStoredTimespanData } from '@/utils/session-storage';

export type TimespanRoute =
  | '/public/$domain'
  | '/_layout/p/$projectId/'
  | '/_layout/p/$projectId/funnels/'
  | '/_layout/p/$projectId/funnels/$funnelId';

interface Props {
  from: TimespanRoute;
}

export const useTimespanParam = ({ from }: Props) => {
  const route = getRouteApi(from);

  const navigate = route.useNavigate();
  const { t, sd, ed } = route.useSearch() as {
    t?: TimeSpan;
    sd?: string;
    ed?: string;
  };
  const hasAnyParam = Boolean(t || sd || ed);

  const storedTimeSpanData = getStoredTimespanData();
  const timespan = t ?? storedTimeSpanData.timespan ?? '24hrs';
  const startDate = sd ?? (hasAnyParam ? undefined : storedTimeSpanData.startDate);
  const endDate = ed ?? (hasAnyParam ? undefined : storedTimeSpanData.endDate);

  useEffect(() => {
    if (t !== timespan || sd !== startDate || ed !== endDate) {
      navigate({
        search: (prev) => ({ ...prev, t: timespan, sd: startDate, ed: endDate }),
        replace: true,
      });
    }

    setStoredTimespanData(timespan, startDate, endDate);
  }, [timespan, t, startDate, sd, endDate, ed, navigate]);

  return { timespan, startDate, endDate };
};
