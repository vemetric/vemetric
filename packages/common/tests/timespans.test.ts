import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isIncompletePeriod } from '../src/charts/timespans';

describe('isIncompletePeriod', () => {
  beforeEach(() => {
    // Mock Date to have predictable tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('thirty_seconds interval', () => {
    it('should return true for current 30-second window', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 15)); // 10:30:15
      const currentWindow = new Date(2024, 5, 15, 10, 30, 0); // 10:30:00
      expect(isIncompletePeriod(currentWindow, 'thirty_seconds')).toBe(true);
    });

    it('should return true for date within current 30-second window', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 45)); // 10:30:45
      const withinWindow = new Date(2024, 5, 15, 10, 30, 35); // 10:30:35
      expect(isIncompletePeriod(withinWindow, 'thirty_seconds')).toBe(true);
    });

    it('should return false for previous 30-second window', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 45)); // 10:30:45
      const previousWindow = new Date(2024, 5, 15, 10, 30, 0); // 10:30:00
      expect(isIncompletePeriod(previousWindow, 'thirty_seconds')).toBe(false);
    });

    it('should return false for much older date', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 15));
      const oldDate = new Date(2024, 5, 15, 10, 29, 0);
      expect(isIncompletePeriod(oldDate, 'thirty_seconds')).toBe(false);
    });
  });

  describe('ten_minutes interval', () => {
    it('should return true for current 10-minute window', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 35, 0)); // 10:35:00
      const currentWindow = new Date(2024, 5, 15, 10, 30, 0); // 10:30:00
      expect(isIncompletePeriod(currentWindow, 'ten_minutes')).toBe(true);
    });

    it('should return true for date within current 10-minute window', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 37, 30)); // 10:37:30
      const withinWindow = new Date(2024, 5, 15, 10, 33, 0); // 10:33:00
      expect(isIncompletePeriod(withinWindow, 'ten_minutes')).toBe(true);
    });

    it('should return false for previous 10-minute window', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 35, 0)); // 10:35:00
      const previousWindow = new Date(2024, 5, 15, 10, 20, 0); // 10:20:00
      expect(isIncompletePeriod(previousWindow, 'ten_minutes')).toBe(false);
    });

    it('should return false for date from previous hour', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 5, 0));
      const oldDate = new Date(2024, 5, 15, 9, 50, 0);
      expect(isIncompletePeriod(oldDate, 'ten_minutes')).toBe(false);
    });
  });

  describe('hourly interval', () => {
    it('should return true for current hour', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 0)); // 10:30:00
      const currentHour = new Date(2024, 5, 15, 10, 0, 0); // 10:00:00
      expect(isIncompletePeriod(currentHour, 'hourly')).toBe(true);
    });

    it('should return true for date within current hour', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 45, 0)); // 10:45:00
      const withinHour = new Date(2024, 5, 15, 10, 15, 0); // 10:15:00
      expect(isIncompletePeriod(withinHour, 'hourly')).toBe(true);
    });

    it('should return false for previous hour', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 0)); // 10:30:00
      const previousHour = new Date(2024, 5, 15, 9, 0, 0); // 09:00:00
      expect(isIncompletePeriod(previousHour, 'hourly')).toBe(false);
    });

    it('should return false for date from yesterday', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 0));
      const yesterday = new Date(2024, 5, 14, 10, 30, 0);
      expect(isIncompletePeriod(yesterday, 'hourly')).toBe(false);
    });
  });

  describe('daily interval', () => {
    it('should return true for today (UTC)', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0))); // June 15, 2024 14:30 UTC
      const today = new Date(Date.UTC(2024, 5, 15, 0, 0, 0)); // June 15, 2024 00:00 UTC
      expect(isIncompletePeriod(today, 'daily')).toBe(true);
    });

    it('should return true for date later today', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 10, 0, 0))); // 10:00 UTC
      const laterToday = new Date(Date.UTC(2024, 5, 15, 18, 0, 0)); // 18:00 UTC (same day)
      expect(isIncompletePeriod(laterToday, 'daily')).toBe(true);
    });

    it('should return false for yesterday', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0))); // June 15, 2024
      const yesterday = new Date(Date.UTC(2024, 5, 14, 12, 0, 0)); // June 14, 2024
      expect(isIncompletePeriod(yesterday, 'daily')).toBe(false);
    });

    it('should return false for date from last week', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0)));
      const lastWeek = new Date(Date.UTC(2024, 5, 8, 12, 0, 0));
      expect(isIncompletePeriod(lastWeek, 'daily')).toBe(false);
    });
  });

  describe('weekly interval', () => {
    it('should return true for current week (Monday start)', () => {
      // June 15, 2024 is a Saturday. Week starts Monday June 10.
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0)));
      const mondayThisWeek = new Date(Date.UTC(2024, 5, 10, 0, 0, 0));
      expect(isIncompletePeriod(mondayThisWeek, 'weekly')).toBe(true);
    });

    it('should return true for date within current week', () => {
      // June 15, 2024 is a Saturday
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0)));
      const wednesdayThisWeek = new Date(Date.UTC(2024, 5, 12, 12, 0, 0));
      expect(isIncompletePeriod(wednesdayThisWeek, 'weekly')).toBe(true);
    });

    it('should return false for previous week', () => {
      // June 15, 2024 is a Saturday. Previous week started June 3.
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0)));
      const previousWeek = new Date(Date.UTC(2024, 5, 5, 0, 0, 0)); // Wednesday June 5
      expect(isIncompletePeriod(previousWeek, 'weekly')).toBe(false);
    });

    it('should handle Sunday correctly (week started on previous Monday)', () => {
      // June 16, 2024 is a Sunday. Week started Monday June 10.
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 16, 14, 30, 0)));
      const mondayThisWeek = new Date(Date.UTC(2024, 5, 10, 0, 0, 0));
      expect(isIncompletePeriod(mondayThisWeek, 'weekly')).toBe(true);
    });

    it('should return false for date from last month', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0)));
      const lastMonth = new Date(Date.UTC(2024, 4, 20, 0, 0, 0)); // May 20
      expect(isIncompletePeriod(lastMonth, 'weekly')).toBe(false);
    });
  });

  describe('monthly interval', () => {
    it('should return true for current month', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0))); // June 15, 2024
      const currentMonth = new Date(Date.UTC(2024, 5, 1, 0, 0, 0)); // June 1, 2024
      expect(isIncompletePeriod(currentMonth, 'monthly')).toBe(true);
    });

    it('should return true for any day in current month', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0))); // June 15, 2024
      const laterInMonth = new Date(Date.UTC(2024, 5, 28, 12, 0, 0)); // June 28, 2024
      expect(isIncompletePeriod(laterInMonth, 'monthly')).toBe(true);
    });

    it('should return false for previous month', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0))); // June 15, 2024
      const previousMonth = new Date(Date.UTC(2024, 4, 15, 12, 0, 0)); // May 15, 2024
      expect(isIncompletePeriod(previousMonth, 'monthly')).toBe(false);
    });

    it('should return false for date from last year', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 5, 15, 14, 30, 0)));
      const lastYear = new Date(Date.UTC(2023, 5, 15, 12, 0, 0)); // June 15, 2023
      expect(isIncompletePeriod(lastYear, 'monthly')).toBe(false);
    });

    it('should handle year boundary correctly', () => {
      vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 14, 30, 0))); // January 15, 2024
      const december = new Date(Date.UTC(2023, 11, 15, 12, 0, 0)); // December 15, 2023
      expect(isIncompletePeriod(december, 'monthly')).toBe(false);
    });
  });

  describe('unknown interval', () => {
    it('should return false for unknown interval types', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 0));
      const date = new Date(2024, 5, 15, 10, 30, 0);
      // @ts-expect-error Testing unknown interval
      expect(isIncompletePeriod(date, 'unknown')).toBe(false);
    });
  });
});
