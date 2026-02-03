import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTimeSpanStartDate, fillTimeSeries } from './timeseries';

describe('getStartDate', () => {
  beforeEach(() => {
    // Mock the current date to a fixed value for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return start date for 1hr timespan', () => {
    const result = getTimeSpanStartDate('1hr');
    expect(result.toISOString()).toBe('2024-01-15T11:10:00.000Z');
  });

  it('should return start date for 24hrs timespan', () => {
    const result = getTimeSpanStartDate('24hrs');
    expect(result.toISOString()).toBe('2024-01-14T13:00:00.000Z');
  });

  it('should return start date for 7days timespan', () => {
    const result = getTimeSpanStartDate('7days');
    expect(result.toISOString()).toBe('2024-01-09T00:00:00.000Z');
  });

  it('should return start date for 30days timespan', () => {
    const result = getTimeSpanStartDate('30days');
    expect(result.toISOString()).toBe('2023-12-17T00:00:00.000Z');
  });

  it('should return start date for 3months timespan', () => {
    const result = getTimeSpanStartDate('3months');
    expect(result.toISOString()).toBe('2023-10-30T00:00:00.000Z');
  });

  it('should return start date for 6months timespan', () => {
    const result = getTimeSpanStartDate('6months');
    expect(result.toISOString()).toBe('2023-08-01T00:00:00.000Z');
  });

  it('should return start date for 1year timespan', () => {
    const result = getTimeSpanStartDate('1year');
    expect(result.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });
});

describe('fillTimeSeries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null for null input', () => {
    const result = fillTimeSeries(null, new Date(), 'hourly');
    expect(result).toBeNull();
  });

  it('should fill missing hourly data points with zeros', () => {
    const timeSeries = [
      { date: '2024-01-15 10:00:00', count: 5 },
      { date: '2024-01-15 12:00:00', count: 10 },
    ];
    const startDate = new Date('2024-01-15T10:00:00Z');

    const result = fillTimeSeries(timeSeries, startDate, 'hourly');

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { date: '2024-01-15T10:00:00.000Z', count: 5 },
      { date: '2024-01-15T11:00:00.000Z', count: 0 },
      { date: '2024-01-15T12:00:00.000Z', count: 10 },
    ]);
  });

  it('should fill missing daily data points with zeros', () => {
    const timeSeries = [
      { date: '2024-01-13 00:00:00', count: 5 },
      { date: '2024-01-15 00:00:00', count: 10 },
    ];
    const startDate = new Date('2024-01-13T00:00:00Z');

    const result = fillTimeSeries(timeSeries, startDate, 'daily');

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { date: '2024-01-13T00:00:00.000Z', count: 5 },
      { date: '2024-01-14T00:00:00.000Z', count: 0 },
      { date: '2024-01-15T00:00:00.000Z', count: 10 },
    ]);
  });

  it('should fill missing monthly data points with zeros', () => {
    const timeSeries = [
      { date: '2023-11-01 00:00:00', count: 5 },
      { date: '2024-01-01 00:00:00', count: 10 },
    ];
    const startDate = new Date('2023-11-01T00:00:00Z');

    const result = fillTimeSeries(timeSeries, startDate, 'monthly');

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { date: '2023-11-01T00:00:00.000Z', count: 5 },
      { date: '2023-12-01T00:00:00.000Z', count: 0 },
      { date: '2024-01-01T00:00:00.000Z', count: 10 },
    ]);
  });

  it('should fill missing ten_minutes data points with zeros', () => {
    const timeSeries = [
      { date: '2024-01-15 11:40:00', count: 5 },
      { date: '2024-01-15 12:00:00', count: 10 },
    ];
    const startDate = new Date('2024-01-15T11:40:00Z');

    const result = fillTimeSeries(timeSeries, startDate, 'ten_minutes');

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { date: '2024-01-15T11:40:00.000Z', count: 5 },
      { date: '2024-01-15T11:50:00.000Z', count: 0 },
      { date: '2024-01-15T12:00:00.000Z', count: 10 },
    ]);
  });

  it('should fill missing weekly data points with zeros', () => {
    const timeSeries = [
      { date: '2024-01-01 00:00:00', count: 5 },
      { date: '2024-01-15 00:00:00', count: 10 },
    ];
    const startDate = new Date('2024-01-01T00:00:00Z');

    const result = fillTimeSeries(timeSeries, startDate, 'weekly');

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { date: '2024-01-01T00:00:00.000Z', count: 5 },
      { date: '2024-01-08T00:00:00.000Z', count: 0 },
      { date: '2024-01-15T00:00:00.000Z', count: 10 },
    ]);
  });

  it('should handle empty time series', () => {
    const timeSeries: Array<{ date: string; count: number }> = [];
    const startDate = new Date('2024-01-15T10:00:00Z');

    const result = fillTimeSeries(timeSeries, startDate, 'hourly');

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { date: '2024-01-15T10:00:00.000Z', count: 0 },
      { date: '2024-01-15T11:00:00.000Z', count: 0 },
      { date: '2024-01-15T12:00:00.000Z', count: 0 },
    ]);
  });
});
