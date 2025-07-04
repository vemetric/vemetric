import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dateTimeFormatter } from '../../src/utils/date-time-formatter';

describe('DateTimeFormatter', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
    // Mock the timezone to UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('formatMonth', () => {
    it('should format month correctly', () => {
      expect(dateTimeFormatter.formatMonth('2024-01-15')).toBe('Jan');
      expect(dateTimeFormatter.formatMonth('2024-12-15')).toBe('Dec');
    });

    it('should handle Date objects', () => {
      expect(dateTimeFormatter.formatMonth(new Date('2024-01-15'))).toBe('Jan');
    });

    it('should handle invalid dates', () => {
      expect(() => dateTimeFormatter.formatMonth('invalid-date')).toThrow();
    });
  });

  describe('formatMonthYear', () => {
    it('should format month and year correctly', () => {
      expect(dateTimeFormatter.formatMonthYear('2024-01-15')).toBe('Jan 24');
      expect(dateTimeFormatter.formatMonthYear('2024-12-15')).toBe('Dec 24');
    });

    it('should handle Date objects', () => {
      expect(dateTimeFormatter.formatMonthYear(new Date('2024-01-15'))).toBe('Jan 24');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time correctly', () => {
      const result = dateTimeFormatter.formatDateTime('2024-01-15T14:30:45');
      expect(result).toMatch(/15\.01\.2024, 14:30:45/);
    });

    it('should handle Date objects', () => {
      const result = dateTimeFormatter.formatDateTime(new Date('2024-01-15T14:30:45'));
      expect(result).toMatch(/15\.01\.2024, 14:30:45/);
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      expect(dateTimeFormatter.formatDate('2024-01-15')).toBe('15.01.2024');
      expect(dateTimeFormatter.formatDate('2024-12-15')).toBe('15.12.2024');
    });

    it('should handle Date objects', () => {
      expect(dateTimeFormatter.formatDate(new Date('2024-01-15'))).toBe('15.01.2024');
    });
  });

  describe('formatTime', () => {
    it('should format time correctly without seconds', () => {
      expect(dateTimeFormatter.formatTime('2024-01-15T14:30:45')).toMatch(/14:30/);
    });

    it('should format time correctly with seconds', () => {
      expect(dateTimeFormatter.formatTime('2024-01-15T14:30:45', true)).toMatch(/14:30:45/);
    });

    it('should handle Date objects', () => {
      expect(dateTimeFormatter.formatTime(new Date('2024-01-15T14:30:45'))).toMatch(/14:30/);
    });
  });

  describe('formatWeek', () => {
    it('should format week correctly', () => {
      expect(dateTimeFormatter.formatWeek('2024-01-15')).toBe('Week 3');
      expect(dateTimeFormatter.formatWeek('2024-01-01')).toBe('Week 1');
    });

    it('should handle Date objects', () => {
      expect(dateTimeFormatter.formatWeek(new Date('2024-01-15'))).toBe('Week 3');
    });

    it('should handle different years', () => {
      expect(dateTimeFormatter.formatWeek('2023-06-15')).toBe('Week 25');
      expect(dateTimeFormatter.formatWeek('2025-03-10')).toBe('Week 11');
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(dateTimeFormatter.formatDuration(45)).toBe('45s');
      expect(dateTimeFormatter.formatDuration(65)).toBe('1m 5s');
      expect(dateTimeFormatter.formatDuration(3665)).toBe('1h 1m 5s');
    });

    it('should handle zero duration', () => {
      expect(dateTimeFormatter.formatDuration(0)).toBe('0s');
    });

    it('should handle negative duration', () => {
      expect(dateTimeFormatter.formatDuration(-45)).toBe('-45s');
    });
  });

  describe('formatDistance', () => {
    it('should format distance correctly', () => {
      const start = '2024-01-15T14:30:00';
      const end = '2024-01-15T15:30:00';
      expect(dateTimeFormatter.formatDistance(start, end)).toBe('1 hour');
    });

    it('should format short distance correctly', () => {
      const start = '2024-01-15T14:30:00';
      const end = '2024-01-15T15:30:00';
      expect(dateTimeFormatter.formatDistance(start, end, true)).toBe('1h');
    });

    it('should handle Date objects', () => {
      const start = new Date('2024-01-15T14:30:00');
      const end = new Date('2024-01-15T15:30:00');
      expect(dateTimeFormatter.formatDistance(start, end)).toBe('1 hour');
    });
  });

  describe('formatDistanceNow', () => {
    it('should format distance from now correctly', () => {
      const past = new Date('2024-01-15T10:00:00Z'); // 2 hours before mocked time
      expect(dateTimeFormatter.formatDistanceNow(past)).toBe('2 hours');
    });

    it('should format short distance from now correctly', () => {
      const past = new Date('2024-01-15T10:00:00Z'); // 2 hours before mocked time
      expect(dateTimeFormatter.formatDistanceNow(past, true)).toBe('2h');
    });
  });

  describe('prepareDate', () => {
    it('should handle string dates with space', () => {
      const result = dateTimeFormatter.formatDateTime('2024-01-15 14:30:45');
      expect(result).toMatch(/15\.01\.2024, 14:30:45/);
    });

    it('should handle string dates with T', () => {
      const result = dateTimeFormatter.formatDateTime('2024-01-15T14:30:45');
      expect(result).toMatch(/15\.01\.2024, 14:30:45/);
    });
  });
});
