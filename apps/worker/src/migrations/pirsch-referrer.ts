import { NO_REFERRER } from '@vemetric/common/sources';
import { getNormalizedDomain } from '@vemetric/common/url';
import { referrers } from '../consts/referrers';

// Pirsch's channels, for referrers that aren't in Vemetric's list. Pirsch's "Direct" also contains visits that
// have a referrer (e.g. Google or t.co), so it says nothing about the source.
const PIRSCH_CHANNEL_TYPES: Record<string, string> = {
  'Organic Search': 'search',
  'Organic Social': 'social',
  'Organic Video': 'social',
  AI: 'llm',
  Email: 'email',
  'Paid Search': 'paid',
  'Paid Social': 'paid',
  Display: 'paid',
};

interface PirschReferrerRow {
  referrer_name?: string;
  referrer?: string;
  channel?: string;
}

// Same result as the worker for natively tracked visits: no referrer is `none`, the own domain is `internal`,
// a listed host gets the list's type and name. Only otherwise Pirsch's channel decides.
export function resolvePirschReferrer(row: PirschReferrerRow, projectDomain?: string) {
  const referrerName = row.referrer_name || '';
  const referrerUrl = row.referrer || '';
  if (!referrerName && !referrerUrl) {
    return { ...NO_REFERRER };
  }

  const host = referrerUrl ? getNormalizedDomain(referrerUrl) : '';
  if (host && projectDomain && host.endsWith(projectDomain)) {
    return { referrer: '', referrerUrl, referrerType: 'internal' };
  }

  // Without a URL, Pirsch's referrer name may be a ref/utm_source value, which the list also knows (e.g. "threads").
  const entry = referrers[(host || referrerName) as keyof typeof referrers];
  if (entry) {
    return { referrer: entry.name, referrerUrl, referrerType: entry.type };
  }

  return {
    referrer: referrerName || host,
    referrerUrl,
    referrerType: PIRSCH_CHANNEL_TYPES[row.channel ?? ''] ?? 'unknown',
  };
}
