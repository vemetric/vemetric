import { getNormalizedDomain } from '@vemetric/common/url';
import type { ReferrerData } from 'clickhouse';
import { dbProject } from 'database';
import { logger } from './logger';
import { referrers } from '../consts/referrers';

export function getReferrer(projectDomain: string | undefined, url: string): ReferrerData | undefined {
  try {
    const resolvedDomain = getNormalizedDomain(url);

    if (projectDomain && resolvedDomain.endsWith(projectDomain)) {
      return {
        referrer: '',
        referrerUrl: url,
        referrerType: 'direct',
      };
    }

    const referrer = referrers[resolvedDomain as keyof typeof referrers];
    if (!referrer) {
      return {
        referrer: resolvedDomain,
        referrerUrl: url,
        referrerType: 'unknown',
      };
    }

    return {
      referrer: referrer.name,
      referrerUrl: url,
      referrerType: referrer.type,
    };
  } catch (err) {
    logger.error({ err }, 'Invalid Referrer URL');
    return {
      referrer: url,
      referrerUrl: url,
      referrerType: 'unknown',
    };
  }
}

export async function getReferrerFromHeaders(projectId: bigint, headers: Record<string, string>) {
  const referrerHeader = headers['v-referrer'];
  let referrer: ReferrerData | undefined = undefined;
  if (referrerHeader) {
    const project = await dbProject.findById(String(projectId));
    referrer = getReferrer(project?.domain, referrerHeader);
  }
  return referrer;
}
