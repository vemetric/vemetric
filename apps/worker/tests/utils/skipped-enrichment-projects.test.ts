import { describe, expect, it } from 'vitest';
import { parseSkippedEnrichmentProjectIds } from '../../src/utils/skipped-enrichment-projects';

describe('parseSkippedEnrichmentProjectIds', () => {
  it('returns an empty set when the setting is absent or blank', () => {
    expect(parseSkippedEnrichmentProjectIds(undefined)).toEqual(new Set());
    expect(parseSkippedEnrichmentProjectIds('  ')).toEqual(new Set());
  });

  it('parses, trims, and deduplicates project IDs', () => {
    expect(parseSkippedEnrichmentProjectIds('123, 456,123,, 789 ')).toEqual(new Set(['123', '456', '789']));
  });
});
