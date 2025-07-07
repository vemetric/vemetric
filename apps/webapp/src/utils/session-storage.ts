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
