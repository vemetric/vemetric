import { getRouteApi } from '@tanstack/react-router';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { useEffect } from 'react';
import { getStoredTimespan, setStoredTimespan } from '@/utils/session-storage';

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
  const { t: _timespan, sd: startDate, ed: endDate } = route.useSearch() as { 
    t?: TimeSpan; 
    sd?: string; 
    ed?: string; 
  };
  const timespan = _timespan ?? getStoredTimespan() ?? '24hrs';

  useEffect(() => {
    if (_timespan !== timespan) {
      navigate({
        search: (prev) => ({ ...prev, t: timespan }),
        replace: true,
      });
    }

    if (timespan !== 'custom') {
      setStoredTimespan(timespan);
    }
  }, [timespan, _timespan, navigate]);

  return { timespan, startDate, endDate };
};
