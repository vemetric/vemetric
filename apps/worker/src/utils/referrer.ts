import { getNormalizedDomain } from '@vemetric/common/url';
import type { ReferrerData } from 'clickhouse';
import { dbProject } from 'database';
import { logger } from './logger';
import { referrers } from '../consts/referrers';

export function getReferrer(
  projectDomain: string | undefined,
  url?: string,
  paramValue?: string,
): ReferrerData | undefined {
  if (!url && !paramValue) {
    return undefined;
  }

  try {
    const resolvedDomain = getNormalizedDomain(url || '');
    if (url && projectDomain && resolvedDomain.endsWith(projectDomain)) {
      return {
        referrer: paramValue || '',
        referrerUrl: url,
        referrerType: 'direct',
      };
    }

    const referrer = referrers[(paramValue || resolvedDomain || '') as keyof typeof referrers];
    return {
      referrer: referrer?.name || paramValue || resolvedDomain,
      referrerUrl: url || '',
      referrerType: referrer?.type || 'unknown',
    };
  } catch (err) {
    logger.error({ err }, 'Invalid Referrer URL');
    return {
      referrer: paramValue || url,
      referrerUrl: url || '',
      referrerType: 'unknown',
    };
  }
}

function getReferrerParamValue(url?: string) {
  let paramValue: string | undefined;
  if (url) {
    try {
      const urlObj = new URL(url);
      const searchParams = urlObj.searchParams;

      if (
        searchParams.get('utm_source') === 'ig' &&
        searchParams.get('utm_medium') === 'social' &&
        searchParams.get('utm_content') === 'link_in_bio'
      ) {
        // special case for Instagram and Threads, we already know the proper referrer here
        return undefined;
      }

      paramValue =
        searchParams.get('ref')?.trim() ||
        searchParams.get('via')?.trim() ||
        searchParams.get('utm_source')?.trim() ||
        searchParams.get('source')?.trim();
    } catch {
      // Invalid URL, continue with header fallback
    }

    return paramValue;
  }
}

export async function getReferrerFromRequest(projectId: bigint, headers: Record<string, string>, url?: string) {
  const paramValue = getReferrerParamValue(url);
  const referrerHeader = headers['v-referrer'];

  const project = await dbProject.findById(String(projectId));
  return getReferrer(project?.domain, referrerHeader || undefined, paramValue);
}
