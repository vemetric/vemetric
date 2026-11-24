import { z } from 'zod';

export const sourcesSchema = z
  .enum(['referrer', 'referrerUrl', 'referrerType', 'utmCampaign', 'utmContent', 'utmMedium', 'utmSource', 'utmTerm'])
  .optional();

export type ISources = z.infer<typeof sourcesSchema>;

export const SOURCE_VALUES = {
  referrer: {
    referrer: 'Referrer',
    referrerUrl: 'Referrer URL',
    referrerType: 'Referrer Type',
  },
  utm: {
    utmCampaign: 'UTM Campaign',
    utmContent: 'UTM Content',
    utmMedium: 'UTM Medium',
    utmSource: 'UTM Source',
    utmTerm: 'UTM Term',
  },
};

export const ALL_SOURCES = { ...SOURCE_VALUES.referrer, ...SOURCE_VALUES.utm };

export const getSourceValue = (
  source: ISources,
): {
  segment: keyof typeof SOURCE_VALUES;
  referrer: keyof typeof SOURCE_VALUES.referrer;
  utm: keyof typeof SOURCE_VALUES.utm;
} => {
  if (source === 'referrer') {
    return { segment: 'referrer', referrer: 'referrer', utm: 'utmCampaign' };
  }

  if (source === 'referrerUrl') {
    return { segment: 'referrer', referrer: 'referrerUrl', utm: 'utmCampaign' };
  }

  if (source === 'referrerType') {
    return { segment: 'referrer', referrer: 'referrerType', utm: 'utmCampaign' };
  }

  if (source === 'utmCampaign') {
    return { segment: 'utm', utm: 'utmCampaign', referrer: 'referrer' };
  }

  if (source === 'utmContent') {
    return { segment: 'utm', utm: 'utmContent', referrer: 'referrer' };
  }

  if (source === 'utmMedium') {
    return { segment: 'utm', utm: 'utmMedium', referrer: 'referrer' };
  }

  if (source === 'utmSource') {
    return { segment: 'utm', utm: 'utmSource', referrer: 'referrer' };
  }

  if (source === 'utmTerm') {
    return { segment: 'utm', utm: 'utmTerm', referrer: 'referrer' };
  }

  return { segment: 'referrer', referrer: 'referrer', utm: 'utmCampaign' };
};

// Stored for visits without a referrer header and without a ref/via/utm_source/source param. Without it the
// insert would fall back to the ClickHouse column default 'unknown', which means "a source without a category".
export const NO_REFERRER = { referrer: '', referrerUrl: '', referrerType: 'none' } as const;

// `direct` was the old name of `internal` (a page on the project's own domain). Old filters, links and API
// clients may still send it, so it stays accepted. It can't get a new meaning.
export const normalizeReferrerType = (value: string) => (value === 'direct' ? 'internal' : value);

export const REFERRER_TYPE_DESCRIPTIONS: Record<string, string> = {
  none: 'No referrer: typed in, bookmarks, apps, or the referrer was removed',
  search: 'Search engines',
  social: 'Social networks and communities',
  llm: 'AI assistants and AI search',
  email: 'Email clients and webmail',
  paid: 'Ad networks',
  unknown: "A website or source that isn't in Vemetric's list of known sources",
  internal: 'A page on your own domain, e.g. a new session after 30 minutes of inactivity',
};

export const getReferrerTypeLabel = (value: string) =>
  value === 'llm' ? 'LLM' : value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
