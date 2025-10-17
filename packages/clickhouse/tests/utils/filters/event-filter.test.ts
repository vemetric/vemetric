import type { IFilterConfig } from '@vemetric/common/filters';
import { describe, it, expect } from 'vitest';
import { buildEventFilterQueries } from '../../../src/utils/filters/event-filter';

describe('buildEventFilterQueries', () => {
  it('should return empty string for undefined filter config', () => {
    expect(buildEventFilterQueries(undefined)).toBe('');
  });

  it('should return empty string for empty filters array', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe('');
  });

  it('should build query for single event filter', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'event',
          nameFilter: { operator: 'is', value: 'click' },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(name = 'click')");
  });

  it('should build query for single page filter', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'page',
          pathFilter: { operator: 'is', value: '/home' },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(pathname = '/home')");
  });

  it('should combine multiple event filters with OR', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'event',
          nameFilter: { operator: 'is', value: 'click' },
        },
        {
          type: 'event',
          nameFilter: { operator: 'is', value: 'submit' },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(name = 'click') OR (name = 'submit')");
  });

  it('should combine multiple page filters with OR', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'page',
          pathFilter: { operator: 'is', value: '/home' },
        },
        {
          type: 'page',
          pathFilter: { operator: 'is', value: '/about' },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(pathname = '/home') OR (pathname = '/about')");
  });

  it('should combine event and page filters with OR', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'event',
          nameFilter: { operator: 'is', value: 'click' },
        },
        {
          type: 'page',
          pathFilter: { operator: 'is', value: '/home' },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(name = 'click') OR (pathname = '/home')");
  });

  it('should handle negative event filters', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'event',
          nameFilter: { operator: 'isNot', value: 'click' },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(name <> 'click')");
  });

  it('should handle negative page filters', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'page',
          pathFilter: { operator: 'isNot', value: '/admin' },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(pathname <> '/admin')");
  });

  it('should combine positive and negative filters correctly', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'event',
          nameFilter: { operator: 'is', value: 'click' },
        },
        {
          type: 'event',
          nameFilter: { operator: 'isNot', value: 'spam' },
        },
      ],
    };
    // Positive filters are joined with OR, negative with AND, then combined with the operator
    expect(buildEventFilterQueries(filterConfig)).toBe("(name = 'click') OR (name <> 'spam')");
  });

  it('should handle page filter with multiple subfilters', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'page',
          pathFilter: { operator: 'is', value: '/home' },
          originFilter: { operator: 'is', value: 'https://example.com' },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(pathname = '/home' AND origin = 'https://example.com')");
  });

  it('should handle event filter with properties', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'event',
          nameFilter: { operator: 'is', value: 'purchase' },
          propertiesFilter: [
            {
              property: 'amount',
              valueFilter: { operator: 'is', value: '100' },
            },
          ],
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toContain("name = 'purchase'");
    expect(buildEventFilterQueries(filterConfig)).toContain('JSONExtractString');
  });

  it('should ignore filters with "any" operator', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'event',
          nameFilter: { operator: 'any', value: '' },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe('');
  });

  it('should handle complex mixed scenario', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'event',
          nameFilter: { operator: 'is', value: 'click' },
        },
        {
          type: 'page',
          pathFilter: { operator: 'contains', value: '/dashboard' },
        },
        {
          type: 'event',
          nameFilter: { operator: 'isNot', value: 'bot' },
        },
      ],
    };
    const result = buildEventFilterQueries(filterConfig);
    expect(result).toContain("name = 'click'");
    expect(result).toContain("pathname ILIKE '%/dashboard%'");
    expect(result).toContain("name <> 'bot'");
  });

  it('should build query for single browser filter', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'browser',
          browserFilter: { operator: 'oneOf', value: ['Chrome', 'Firefox'] },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(clientName IN ('Chrome','Firefox'))");
  });

  it('should build query for single device filter', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'device',
          deviceFilter: { operator: 'oneOf', value: ['desktop', 'mobile'] },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(deviceType IN ('desktop','mobile'))");
  });

  it('should build query for single OS filter', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'os',
          osFilter: { operator: 'oneOf', value: ['macOS', 'Windows'] },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(osName IN ('macOS','Windows'))");
  });

  it('should handle negative browser filter', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'browser',
          browserFilter: { operator: 'noneOf', value: ['IE'] },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(clientName NOT IN ('IE'))");
  });

  it('should combine event, page, browser, device, and OS filters', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'event',
          nameFilter: { operator: 'is', value: 'purchase' },
        },
        {
          type: 'page',
          pathFilter: { operator: 'contains', value: '/checkout' },
        },
        {
          type: 'browser',
          browserFilter: { operator: 'oneOf', value: ['Chrome'] },
        },
        {
          type: 'device',
          deviceFilter: { operator: 'oneOf', value: ['mobile'] },
        },
        {
          type: 'os',
          osFilter: { operator: 'oneOf', value: ['iOS'] },
        },
      ],
    };
    const result = buildEventFilterQueries(filterConfig);
    expect(result).toContain("name = 'purchase'");
    expect(result).toContain("pathname ILIKE '%/checkout%'");
    expect(result).toContain("clientName IN ('Chrome')");
    expect(result).toContain("deviceType IN ('mobile')");
    expect(result).toContain("osName IN ('iOS')");
  });

  it('should handle multiple browser filters with OR', () => {
    const filterConfig: IFilterConfig = {
      operator: 'and',
      filters: [
        {
          type: 'browser',
          browserFilter: { operator: 'oneOf', value: ['Chrome'] },
        },
        {
          type: 'browser',
          browserFilter: { operator: 'oneOf', value: ['Firefox'] },
        },
      ],
    };
    expect(buildEventFilterQueries(filterConfig)).toBe("(clientName IN ('Chrome')) OR (clientName IN ('Firefox'))");
  });
});
