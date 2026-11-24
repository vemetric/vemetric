import { describe, expect, it } from 'vitest';
import { buildReferrerTypeFilterQuery } from '../../../src/utils/filters/referrer-filter';

describe('buildReferrerTypeFilterQuery', () => {
  it('maps the old name direct to internal', () => {
    expect(
      buildReferrerTypeFilterQuery({
        type: 'referrerType',
        referrerTypeFilter: { operator: 'oneOf', value: ['direct'] },
      }),
    ).toBe(`(referrerType IN ('internal'))`);
  });

  it('removes duplicates when direct and internal are both given', () => {
    expect(
      buildReferrerTypeFilterQuery({
        type: 'referrerType',
        referrerTypeFilter: { operator: 'noneOf', value: ['direct', 'internal', 'none'] },
      }),
    ).toBe(`(referrerType NOT IN ('internal','none'))`);
  });

  it('keeps the other types unchanged', () => {
    expect(
      buildReferrerTypeFilterQuery({
        type: 'referrerType',
        referrerTypeFilter: { operator: 'oneOf', value: ['none', 'unknown', 'search'] },
      }),
    ).toBe(`(referrerType IN ('none','unknown','search'))`);
  });
});
