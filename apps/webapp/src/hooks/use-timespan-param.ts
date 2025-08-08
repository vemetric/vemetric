import { getRouteApi } from '@tanstack/react-router';
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
  const { t: _timespan } = route.useSearch();
  const timespan = _timespan ?? getStoredTimespan() ?? '24hrs';

  useEffect(() => {
    if (_timespan !== timespan) {
      navigate({
        search: (prev) => ({ ...prev, t: timespan }),
        replace: true,
      });
    }

    setStoredTimespan(timespan);
  }, [timespan, _timespan, navigate]);

  return { timespan };
};
