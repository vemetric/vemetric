import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { TIME_SPANS } from '@vemetric/common/charts/timespans';

const TIMESPAN_STORAGE_KEY = 'vemetric-timespan';

export const getStoredTimespan = (): TimeSpan | null => {
  if (typeof window === 'undefined') return null;

  try {
    const timespan = sessionStorage.getItem(TIMESPAN_STORAGE_KEY);
    if (timespan && TIME_SPANS.includes(timespan as TimeSpan)) {
      return timespan as TimeSpan;
    }
  } catch {
    // ignore
  }

  return null;
};

export const setStoredTimespan = (timespan: TimeSpan): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(TIMESPAN_STORAGE_KEY, timespan);
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
