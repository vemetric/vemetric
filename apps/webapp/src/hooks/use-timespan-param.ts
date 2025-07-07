import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { getStoredTimespan, setStoredTimespan } from '@/utils/session-storage';

interface Props {
  publicDashboard?: boolean;
}

export const useTimespanParam = ({ publicDashboard }: Props) => {
  const navigate = useNavigate({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });
  const { t: _timespan } = useSearch({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
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
