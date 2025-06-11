import { describe, it, expect } from 'vitest';
import { hasMultipleSubfiltersActive, type IFilter } from '../src/filters';

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
