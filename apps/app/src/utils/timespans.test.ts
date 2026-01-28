import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeSpanSearchMiddleware } from './timespans';

describe('timespans', () => {
  describe('formatTimeSpanDateRange', () => {
    let formatTimeSpanDateRange: any;

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      // Re-import the module to get fresh currentYear value
      vi.resetModules();
      const module = await import('./timespans');
      formatTimeSpanDateRange = module.formatTimeSpanDateRange;
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.resetModules();
    });

    describe('single date formatting', () => {
      it('should format single date in current year without year', () => {
        expect(formatTimeSpanDateRange('2024-03-15')).toBe('Mar 15');
      });

      it('should format single date in different year with year', () => {
        expect(formatTimeSpanDateRange('2023-03-15')).toBe('Mar 15, 2023');
      });

      it('should format January date correctly', () => {
        expect(formatTimeSpanDateRange('2024-01-01')).toBe('Jan 1');
      });

      it('should format December date correctly', () => {
        expect(formatTimeSpanDateRange('2024-12-31')).toBe('Dec 31');
      });
    });

    describe('full month range formatting', () => {
      it('should format single full month in current year', () => {
        expect(formatTimeSpanDateRange('2024-03-01', '2024-03-31')).toBe('March');
      });

      it('should format single full month in different year', () => {
        expect(formatTimeSpanDateRange('2023-03-01', '2023-03-31')).toBe('March 2023');
      });

      it('should format multiple full months in current year', () => {
        expect(formatTimeSpanDateRange('2024-03-01', '2024-05-31')).toBe('March - May');
      });

      it('should format multiple full months in same non-current year', () => {
        expect(formatTimeSpanDateRange('2023-03-01', '2023-05-31')).toBe('March - May 2023');
      });

      it('should format multiple full months across years', () => {
        expect(formatTimeSpanDateRange('2023-11-01', '2024-01-31')).toBe('November 2023 - January 2024');
      });

      it('should handle February correctly (28 days)', () => {
        expect(formatTimeSpanDateRange('2023-02-01', '2023-02-28')).toBe('February 2023');
      });

      it('should handle February correctly in leap year (29 days)', () => {
        expect(formatTimeSpanDateRange('2024-02-01', '2024-02-29')).toBe('February');
      });

      it('should handle months with 30 days', () => {
        expect(formatTimeSpanDateRange('2024-04-01', '2024-04-30')).toBe('April');
      });
    });

    describe('partial date range formatting', () => {
      it('should format range within same month in current year', () => {
        expect(formatTimeSpanDateRange('2024-03-15', '2024-03-25')).toBe('Mar 15 - 25');
      });

      it('should format range within same month in different year', () => {
        expect(formatTimeSpanDateRange('2023-03-15', '2023-03-25')).toBe('Mar 15 - 25, 2023');
      });

      it('should format range across different months in current year', () => {
        expect(formatTimeSpanDateRange('2024-03-15', '2024-04-25')).toBe('Mar 15 - Apr 25');
      });

      it('should format range across different months in different year', () => {
        expect(formatTimeSpanDateRange('2023-03-15', '2023-04-25')).toBe('Mar 15 - Apr 25, 2023');
      });

      it('should format range across different years', () => {
        expect(formatTimeSpanDateRange('2023-12-15', '2024-01-25')).toBe('Dec 15, 2023 - Jan 25, 2024');
      });

      it('should handle single day range properly', () => {
        expect(formatTimeSpanDateRange('2024-03-15', '2024-03-16')).toBe('Mar 15 - 16');
      });

      it('should handle year boundary correctly', () => {
        expect(formatTimeSpanDateRange('2023-12-31', '2024-01-01')).toBe('Dec 31, 2023 - Jan 1, 2024');
      });
    });

    describe('edge cases', () => {
      it('should handle dates at the beginning of year', () => {
        expect(formatTimeSpanDateRange('2024-01-01', '2024-01-15')).toBe('Jan 1 - 15');
      });

      it('should handle dates at the end of year', () => {
        expect(formatTimeSpanDateRange('2024-12-15', '2024-12-31')).toBe('Dec 15 - 31');
      });

      it('should handle very old dates', () => {
        expect(formatTimeSpanDateRange('2010-06-15')).toBe('Jun 15, 2010');
      });

      it('should handle date range spanning multiple years', () => {
        expect(formatTimeSpanDateRange('2022-06-15', '2024-03-20')).toBe('Jun 15, 2022 - Mar 20, 2024');
      });
    });
  });

  describe('timeSpanSearchMiddleware', () => {
    const mockNext = vi.fn((search) => search);

    beforeEach(() => {
      mockNext.mockClear();
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      vi.resetModules();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.resetModules();
    });

    describe('non-custom timespan handling', () => {
      it('should remove sd and ed when timespan is not custom', () => {
        const search = { t: '24hrs' as const, sd: '2024-01-01', ed: '2024-01-15' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('24hrs');
        expect(result.sd).toBeUndefined();
        expect(result.ed).toBeUndefined();
      });

      it('should preserve non-custom timespan values', () => {
        const timespans = ['live', '1hr', '24hrs', '7days', '30days', '3months', '6months', '1year'] as const;

        timespans.forEach((timespan) => {
          const search = { t: timespan };
          const result = timeSpanSearchMiddleware({ search, next: mockNext });
          expect(result.t).toBe(timespan);
        });
      });
    });

    describe('custom timespan validation', () => {
      it('should fallback to 24hrs when custom timespan has no start date', () => {
        const search = { t: 'custom' as const };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('24hrs');
        expect(result.sd).toBeUndefined();
        expect(result.ed).toBeUndefined();
      });

      it('should keep valid custom date range', () => {
        const search = { t: 'custom' as const, sd: '2024-01-01', ed: '2024-01-15' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('custom');
        expect(result.sd).toBe('2024-01-01');
        expect(result.ed).toBe('2024-01-15');
      });

      it('should allow custom range with only start date', () => {
        const search = { t: 'custom' as const, sd: '2024-01-01' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('custom');
        expect(result.sd).toBe('2024-01-01');
        expect(result.ed).toBeUndefined();
      });

      it('should remove end date if it is before start date', () => {
        const search = { t: 'custom' as const, sd: '2024-01-15', ed: '2024-01-01' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('custom');
        expect(result.sd).toBe('2024-01-15');
        expect(result.ed).toBeUndefined();
      });

      it('should remove end date if it is same as start date', () => {
        const search = { t: 'custom' as const, sd: '2024-01-15', ed: '2024-01-15' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('custom');
        expect(result.sd).toBe('2024-01-15');
        expect(result.ed).toBeUndefined();
      });

      it('should fallback to 24hrs for invalid start date format', () => {
        const search = { t: 'custom' as const, sd: 'invalid-date', ed: '2024-01-15' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('24hrs');
        expect(result.sd).toBeUndefined();
        expect(result.ed).toBeUndefined();
      });

      it('should remove invalid end date but keep valid start date', () => {
        const search = { t: 'custom' as const, sd: '2024-01-01', ed: 'invalid-date' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('custom');
        expect(result.sd).toBe('2024-01-01');
        expect(result.ed).toBeUndefined();
      });

      it('should fallback to 24hrs if start date is before minimum range', () => {
        const search = { t: 'custom' as const, sd: '2009-12-31', ed: '2024-01-15' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('24hrs');
        expect(result.sd).toBeUndefined();
        expect(result.ed).toBeUndefined();
      });

      it('should fallback to 24hrs if start date is after maximum range', async () => {
        // Reset modules and re-import to get fresh timeSpanRangeMax
        vi.resetModules();
        const { timeSpanSearchMiddleware: freshMiddleware } = await import('./timespans');

        // The maximum range is end of current month (Jan 2024), so Feb 1 is after max
        const search = { t: 'custom' as const, sd: '2024-02-01', ed: '2024-02-15' };
        const result = freshMiddleware({ search, next: mockNext });

        expect(result.t).toBe('24hrs');
        expect(result.sd).toBeUndefined();
        expect(result.ed).toBeUndefined();
      });

      it('should remove end date if it is after maximum range', async () => {
        // Reset modules and re-import to get fresh timeSpanRangeMax
        vi.resetModules();
        const { timeSpanSearchMiddleware: freshMiddleware } = await import('./timespans');

        // The maximum range is end of current month (Jan 2024), so Feb 1 is after max
        const search = { t: 'custom' as const, sd: '2024-01-01', ed: '2024-02-01' };
        const result = freshMiddleware({ search, next: mockNext });

        expect(result.t).toBe('custom');
        expect(result.sd).toBe('2024-01-01');
        expect(result.ed).toBeUndefined();
      });

      it('should handle dates at the boundaries correctly', () => {
        const minDateStr = '2010-01-01';
        const search = { t: 'custom' as const, sd: minDateStr, ed: '2024-01-15' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('custom');
        expect(result.sd).toBe(minDateStr);
        expect(result.ed).toBe('2024-01-15');
      });

      it('should handle malformed date strings', async () => {
        // Reset modules and re-import to get fresh timeSpanRangeMax
        vi.resetModules();
        const { timeSpanSearchMiddleware: freshMiddleware } = await import('./timespans');

        // Month 13 doesn't exist, this creates invalid date (rolls over to next year)
        const search = { t: 'custom' as const, sd: '2024-13-01', ed: '2024-01-15' };
        const result = freshMiddleware({ search, next: mockNext });

        // The date parsing creates 2025-01-01 which is after max range
        expect(result.t).toBe('24hrs');
        expect(result.sd).toBeUndefined();
        expect(result.ed).toBeUndefined();
      });

      it('should handle dates with incorrect separators', () => {
        const search = { t: 'custom' as const, sd: '2024/01/15', ed: '2024-01-20' };
        const result = timeSpanSearchMiddleware({ search, next: mockNext });

        expect(result.t).toBe('24hrs');
        expect(result.sd).toBeUndefined();
        expect(result.ed).toBeUndefined();
      });
    });
  });
});
