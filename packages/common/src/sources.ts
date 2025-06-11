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
