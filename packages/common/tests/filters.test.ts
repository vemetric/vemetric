import { describe, it, expect } from 'vitest';
import { filterConfigSchema, hasMultipleSubfiltersActive, type IFilter } from '../src/filters';

describe('hasMultipleSubfiltersActive', () => {
  it('should return false for a filter with no active subfilters', () => {
    const filter: IFilter = {
      type: 'page',
      originFilter: { operator: 'any', value: '' },
      pathFilter: { operator: 'any', value: '' },
    };
    expect(hasMultipleSubfiltersActive(filter)).toBe(false);
  });

  it('should return false for a filter with one active subfilter', () => {
    const filter: IFilter = {
      type: 'page',
      originFilter: { operator: 'contains', value: 'test' },
      pathFilter: { operator: 'any', value: '' },
    };
    expect(hasMultipleSubfiltersActive(filter)).toBe(false);
  });

  it('should return true for a filter with multiple active subfilters', () => {
    const filter: IFilter = {
      type: 'page',
      originFilter: { operator: 'contains', value: 'test' },
      pathFilter: { operator: 'startsWith', value: '/blog' },
    };
    expect(hasMultipleSubfiltersActive(filter)).toBe(true);
  });
});

describe('referrer type filter', () => {
  it('reads the old name direct as internal', () => {
    const parsed = filterConfigSchema.parse({
      operator: 'and',
      filters: [
        { type: 'referrerType', referrerTypeFilter: { operator: 'oneOf', value: ['direct', 'internal', 'none'] } },
      ],
    });
    expect(parsed?.filters[0]).toEqual({
      type: 'referrerType',
      referrerTypeFilter: { operator: 'oneOf', value: ['internal', 'none'] },
    });
  });
});
