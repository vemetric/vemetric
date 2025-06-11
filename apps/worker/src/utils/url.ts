import type { UrlData } from 'clickhouse';
import { logger } from './logger';

const DEFAULT_URL_PARAMS: UrlData = {};

export function getUrlParams(url: string | undefined) {
  let urlParams = DEFAULT_URL_PARAMS;

  if (url) {
    try {
      const eventUrl = new URL(url);

      let pathname = eventUrl.pathname;
      if (pathname !== '/' && pathname.endsWith('/')) {
        // remove trailing slashes for consistency
        pathname = pathname.slice(0, -1);
      }

      let origin = eventUrl.origin;
      if (origin.startsWith('http://')) {
        origin = origin.replace('http://', 'https://');
      }
      if (origin.startsWith('https://www.')) {
        origin = origin.replace('https://www.', 'https://');
      }

      urlParams = {
        origin,
        pathname,
        urlHash: eventUrl.hash,
        queryParams: Object.fromEntries(eventUrl.searchParams),
        utmSource: eventUrl.searchParams.get('utm_source') ?? undefined,
        utmMedium: eventUrl.searchParams.get('utm_medium') ?? undefined,
        utmCampaign: eventUrl.searchParams.get('utm_campaign') ?? undefined,
        utmContent: eventUrl.searchParams.get('utm_content') ?? undefined,
        utmTerm: eventUrl.searchParams.get('utm_term') ?? undefined,
      };
    } catch (err) {
      logger.error({ err }, 'Invalid Event URL');
    }
  }

  return urlParams;
}
