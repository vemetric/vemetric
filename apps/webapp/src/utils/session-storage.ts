import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { TIME_SPANS } from '@vemetric/common/charts/timespans';

const TIMESPAN_STORAGE_KEY = 'vemetric-timespan';

export const getStoredTimespanData = (): {
  timespan: TimeSpan | null;
  startDate: string | undefined;
  endDate: string | undefined;
} => {
  if (typeof window === 'undefined') return { timespan: null, startDate: undefined, endDate: undefined };

  try {
    const timespan = sessionStorage.getItem(TIMESPAN_STORAGE_KEY);
    if (timespan && TIME_SPANS.includes(timespan as TimeSpan)) {
      return {
        timespan: timespan as TimeSpan,
        startDate: sessionStorage.getItem(`${TIMESPAN_STORAGE_KEY}-start`) ?? undefined,
        endDate: sessionStorage.getItem(`${TIMESPAN_STORAGE_KEY}-end`) ?? undefined,
      };
    }
  } catch {
    // ignore
  }

  return { timespan: null, startDate: undefined, endDate: undefined };
};

export const setStoredTimespanData = (timespan: TimeSpan, startDate?: string, endDate?: string): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(TIMESPAN_STORAGE_KEY, timespan);
    if (startDate) {
      sessionStorage.setItem(`${TIMESPAN_STORAGE_KEY}-start`, startDate);
    } else {
      sessionStorage.removeItem(`${TIMESPAN_STORAGE_KEY}-start`);
    }
    if (endDate) {
      sessionStorage.setItem(`${TIMESPAN_STORAGE_KEY}-end`, endDate);
    } else {
      sessionStorage.removeItem(`${TIMESPAN_STORAGE_KEY}-end`);
    }
  } catch {
    // ignore
  }
};

const ACTIVE_USERS_VISIBLE_STORAGE_KEY = 'vemetric-active-users-visible';

export const getStoredActiveUsersVisible = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const activeUsersVisible = sessionStorage.getItem(ACTIVE_USERS_VISIBLE_STORAGE_KEY);
    if (activeUsersVisible === 'true') {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
};

export const setStoredActiveUsersVisible = (activeUsersVisible: boolean): void => {
  if (typeof window === 'undefined') return;

  try {
    if (activeUsersVisible) {
      sessionStorage.setItem(ACTIVE_USERS_VISIBLE_STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(ACTIVE_USERS_VISIBLE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
};
